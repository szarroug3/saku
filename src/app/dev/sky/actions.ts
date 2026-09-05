"use server";

// What the Observatory can do to the learner's history, as server actions
// the route hands to the page. Dev-only, like the adapters beside it.

import { revalidatePath } from "next/cache";

import { currentUserId } from "@/lib/auth";
import { saveClaims } from "@/lib/history";
import type { AtlasEntry, AtlasSearchResult } from "@/sky/components/sky-atlas";

import { atlasEntryFromHistory, atlasSearchFromHistory, learnerHistory } from "./atlas";
import { pickFacts } from "./observatory";
import { sampleHistory } from "./sample-learner";

/** "I already know these": claim the picks, the app's own claim (a skip of
 * the lesson, untested; never mastery, and a later miss outranks it). Each
 * pick claims only itself. */
export async function claimPicks(ids: readonly string[]): Promise<void> {
  const userId = await currentUserId();
  if (!userId) return;
  const facts = pickFacts(ids);
  if (facts.length === 0) return;
  await saveClaims(userId, facts, Date.now());
  revalidatePath("/dev/sky/observatory");
  revalidatePath("/dev/sky/planetarium");
}

/** The Atlas's search, over the app's own index, on the learner's history
 * (or the pretend learner's, when the page shows the sample). Bound to
 * `sample` by the route, so the page calls it with the query alone. */
export async function atlasSearch(sample: boolean, query: string): Promise<AtlasSearchResult> {
  const history = sample ? sampleHistory() : await learnerHistory();
  return atlasSearchFromHistory(history, query);
}

/** One Atlas entry, opened: the card's teaching and what relates to it. */
export async function atlasEntry(sample: boolean, id: string): Promise<AtlasEntry> {
  const history = sample ? sampleHistory() : await learnerHistory();
  const entry = atlasEntryFromHistory(history, id);
  if (!entry) throw new Error(`No Atlas entry: ${id}`);
  return entry;
}

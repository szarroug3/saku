"use server";

// What the Observatory can do to the learner's history, as server actions
// the route hands to the page. Dev-only, like the adapters beside it.

import { revalidatePath } from "next/cache";

import { currentUserId } from "@/lib/auth";
import { saveClaims } from "@/lib/history";

import { pickFacts } from "./observatory";

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

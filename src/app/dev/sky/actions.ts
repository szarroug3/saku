"use server";

// What the Observatory can do to the learner's history, as server actions
// the route hands to the page. Dev-only, like the adapters beside it.

import { revalidatePath } from "next/cache";

import { currentUserId } from "@/lib/auth";
import { saveClaims } from "@/lib/history";

import { trackFacts } from "./observatory";

/** "I already know these": claim a whole track, the app's own claim (a skip
 * of the lesson, untested; never mastery, and a later miss outranks it). */
export async function claimTrack(track: string): Promise<void> {
  const userId = await currentUserId();
  if (!userId) return;
  const facts = trackFacts(track);
  if (facts.length === 0) return;
  await saveClaims(userId, facts, Date.now());
  revalidatePath("/dev/sky/observatory");
  revalidatePath("/dev/sky/planetarium");
}

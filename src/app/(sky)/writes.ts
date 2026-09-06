"use client";

// The Sky's writes, on the client, through the app's own progress calls:
// each lands on the account when signed in, and in the browser when not
// (the same pure ops, carried up on sign-in), announcing itself either way
// so the copy on screen follows. The server only computes what a write
// needs (see actions.ts).

import { postClaim, postClearMixup, postSeen, postSession } from "@/lib/progress-fetch";
import type { QuizAnswer } from "@/sky/lib/quiz";

import { factsOfPicks, quizRecords } from "./actions";

/** The Quiz's answers, recorded as the app's session records. */
export async function recordAnswers(answers: readonly QuizAnswer[]): Promise<void> {
  for (const record of await quizRecords(answers)) {
    const r = await postSession(record);
    if (!r.ok) throw new Error("not recorded");
  }
}

/** "I know these": a claim on the picks' facts. */
export async function claimIds(ids: readonly string[]): Promise<void> {
  const facts = await factsOfPicks(ids);
  if (facts.length) await postClaim(facts, true);
}

/** "I don't know these": the claim withdrawn. */
export async function unclaimIds(ids: readonly string[]): Promise<void> {
  const facts = await factsOfPicks(ids);
  if (facts.length) await postClaim(facts, false);
}

/** A star opened in a lesson: its facts marked seen, so it is in rotation. */
export async function seeId(id: string): Promise<void> {
  const facts = await factsOfPicks([id]);
  if (facts.length) await postSeen(facts);
}

/** A mix-up cleared by hand, from now. */
export async function clearMixUpKey(key: string): Promise<void> {
  await postClearMixup(key, Date.now());
}

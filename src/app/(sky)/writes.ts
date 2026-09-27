"use client";

// The Sky's writes, on the client, through the app's own progress calls:
// each lands on the account when signed in, and in the browser when not
// (the same pure ops, carried up on sign-in), announcing itself either way
// so the copy on screen follows. The server only computes what a write
// needs (see actions.ts).

import { unmetFacts } from "@/lib/history-ops";
import { postClaim, postClearMixup, postSeen, postSession, postUnlearn } from "@/lib/progress-fetch";
import { loadLocalHistory } from "@/lib/store/local-progress";
import type { QuizAnswer } from "@/sky/lib/quiz";
import type { FactId } from "@/types/facts";

import { factsOfPicks, factsToSee, quizRecords } from "./actions";

/**
 * The Quiz's answers, recorded as the app's session records.
 *
 * THE ROUND TRIP THAT CANNOT BE MOVED. `quizRecords` is what turns answers
 * into a record, so the write cannot come before it: signed out, `postSession`
 * writes to the browser in its own turn (SAK-406), which means the whole gap
 * between finishing a quiz and having a record is this one server action. It
 * stays a server action because it reads `factInfo`, and that is the ~3.6 MB
 * fact registry -- moving it into the browser to close a sub-second window
 * would put the registry on every quiz page to do it.
 *
 * So the window is closed at the other end instead: the results screen says
 * "Saving this run." and holds its way back until this resolves (SAK-410, see
 * SaveState in sky/components/quiz-results.tsx). Nobody leaves inside it.
 *
 * A PRACTICE RUN COMES HERE TOO (SAK-441). It hands in `practice`, which marks
 * the records with the screen they came from and the recipe's name, and is
 * otherwise this exact path: the same grades, the same records, the same
 * schedule.
 */
export async function recordAnswers(answers: readonly QuizAnswer[], practice?: { name?: string }): Promise<void> {
  for (const record of await quizRecords(answers, practice)) {
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

/**
 * What a lesson finds new when it starts: the facts of its picks the learner
 * has not met (SAK-492). The sitting keeps them, so forgetting the lesson
 * makes them brand new again whatever the lesson did to them in the meantime
 * (Sam, 2026-09-27: "as if the lesson had never been started"). The account
 * answers for a signed-in learner; for a visitor the server has nothing to
 * read, and this browser's history is asked instead.
 */
export async function freshFactsOf(picks: readonly string[]): Promise<FactId[]> {
  const { facts, fresh } = await factsToSee(picks);
  return fresh ?? unmetFacts(loadLocalHistory(), facts);
}

/**
 * A star opened in a lesson: its facts marked seen, so it is in rotation.
 *
 * AND WHICH OF THEM THIS WAS THE FIRST MARK ON (SAK-492): the facts not met
 * before the write, asked the way `freshFactsOf` asks, before the write lands.
 * The lesson keeps them on its sitting beside what it found new at the start,
 * so forgetting the lesson can take back what it marked and nothing an earlier
 * lesson did.
 */
export async function seeId(id: string): Promise<FactId[]> {
  const { facts, fresh } = await factsToSee([id]);
  if (!facts.length) return [];
  const first = fresh ?? unmetFacts(loadLocalHistory(), facts);
  await postSeen(facts);
  return first;
}

/** A forgotten lesson's marks taken back, so its facts are brand new again
 * (SAK-492): what it found new when it started and what it marked first. */
export async function unlearnFacts(facts: readonly string[]): Promise<void> {
  if (facts.length) await postUnlearn(facts as FactId[]);
}

/** A mix-up cleared by hand, from now. */
export async function clearMixUpKey(key: string): Promise<void> {
  await postClearMixup(key, Date.now());
}

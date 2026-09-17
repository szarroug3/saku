// What a session record looks like under the sky: which screen asked, what
// the deck was called, and the grade each card came out with.
//
// The kinds matter because of SAK-441, which reverses SAK-318: a practice run
// is recorded exactly as a quiz is, through the same recorder and into the
// same drill record, so the mark the run leaves on the record is the only
// thing that tells the two apart in this list.

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { QuizSessionRecord } from "@/types/store";

import { sampleHistory } from "./sample-learner";
import { sessionsFromHistory } from "./sessions";

const NOW = Date.UTC(2026, 8, 16);

/** The sample learner's newest record, and the history holding only it. */
function newest(): { record: QuizSessionRecord; only: (r: QuizSessionRecord) => ReturnType<typeof sessionsFromHistory> } {
  const history = sampleHistory(NOW);
  const record = [...history.sessions].sort((a, b) => b.ts - a.ts)[0];
  return { record, only: (r) => sessionsFromHistory({ ...history, sessions: [r] }, NOW) };
}

describe("a session's kind", () => {
  it("calls a drill record a quiz", () => {
    const { record, only } = newest();
    const [session] = only(record);
    assert.equal(session.kind, "quiz");
    assert.equal(session.name, undefined);
  });

  it("calls a marked record a practice run, cards and grades unchanged", () => {
    const { record, only } = newest();
    const [asQuiz] = only(record);
    const [asPractice] = only({ ...record, practice: {} });
    assert.equal(asPractice.kind, "practice");
    assert.deepEqual(asPractice.cards, asQuiz.cards);
  });

  it("carries the recipe's name when the run had one", () => {
    const { record, only } = newest();
    const [session] = only({ ...record, practice: { name: "Evening drill" } });
    assert.equal(session.name, "Evening drill");
  });
});

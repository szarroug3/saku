import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { askFromAudioPrompts } from "@/lib/ask-config";
import { forLessonOrigin } from "@/lib/lesson-snapshot";
import type { QuizSnapshot } from "@/lib/quiz-session-types";

/** A snapshot a user's Practice settings might have produced: a count-limited
 * grid, audio prompts on. The lesson force should override mode and length but
 * keep the prompt format (carried on `ask`). */
function userSnap(over: Partial<QuizSnapshot> = {}): QuizSnapshot {
  return {
    mode: "grid",
    ask: askFromAudioPrompts(true),
    pairResponses: ["definition"],
    gridResponses: ["definition"],
    length: "endless",
    limType: "count",
    limCount: 20,
    ...over,
  };
}

describe("forLessonOrigin — lesson quizzes are lesson-driven", () => {
  test("a lesson forces a full-coverage drill, whatever the user set", () => {
    const out = forLessonOrigin(userSnap(), "lesson");
    assert.equal(out.mode, "drill");
    assert.equal(out.length, "limited");
    assert.equal(out.limType, "cov");
  });

  test("the prompt format (carried on ask) is kept live", () => {
    const out = forLessonOrigin(userSnap(), "lesson");
    // audio prompts survive the force — environmental, not the lesson's. Text is
    // always present too, so production stays reachable regardless.
    assert.deepEqual(out.ask.japanese.prompts, ["text", "audio"]);
    assert.ok(out.ask.japanese.prompts.includes("text"));
  });

  test("the assembly pin wins so a sentence-ordering lesson keeps assembly", () => {
    const out = forLessonOrigin(userSnap({ mode: "assembly" }), "lesson");
    assert.equal(out.mode, "assembly");
    // still forced to full coverage
    assert.equal(out.length, "limited");
    assert.equal(out.limType, "cov");
  });

  test("a library slice is a practice run — settings are honoured, no force", () => {
    const snap = userSnap();
    assert.deepEqual(forLessonOrigin(snap, "library"), snap);
  });

  test("an undefined origin (one-off quiz path) is not forced", () => {
    const snap = userSnap();
    assert.deepEqual(forLessonOrigin(snap, undefined), snap);
  });

  test("does not mutate the input snapshot", () => {
    const snap = userSnap();
    forLessonOrigin(snap, "lesson");
    assert.equal(snap.mode, "grid");
    assert.equal(snap.length, "endless");
  });
});

import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { askFromInput } from "@/lib/ask-config";
import { forLessonOrigin } from "@/lib/lesson-snapshot";
import type { QuizSnapshot } from "@/lib/quiz-session-types";

/** A snapshot a user's Practice settings might have produced: a count-limited
 * grid, audio input. The lesson force should override mode and length but keep
 * the input (carried on `ask`). */
function userSnap(over: Partial<QuizSnapshot> = {}): QuizSnapshot {
  return {
    mode: "grid",
    ask: askFromInput("audio"),
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

  test("the input format (carried on ask) is kept live", () => {
    const out = forLessonOrigin(userSnap(), "lesson");
    // audio input survives the force — it is environmental, not the lesson's.
    assert.deepEqual(out.ask.japanese.prompts, ["audio"]);
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

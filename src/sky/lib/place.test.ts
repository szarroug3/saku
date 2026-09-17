import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  hasPlace,
  lessonToKeep,
  newestPlace,
  NO_PLACE,
  placeDoc,
  placeEntries,
  placeLabel,
  placeNote,
  readPlace,
  samePicks,
  type SavedLesson,
  type SavedPlace,
} from "./place";
import type { QuizAnswer } from "./quiz";
import type { SavedRun } from "./quiz-run";

const answer = (cardId: string): QuizAnswer => ({ cardId, grade: "clean", tries: 1, narrowed: false, hinted: false });

const run = (over: Partial<SavedRun> = {}): SavedRun => ({
  deck: ["a", "b", "c", "d"],
  at: 2,
  answers: [answer("a"), answer("b")],
  from: { picks: ["kana-row:h-vowels"] },
  leftAt: 1000,
  ...over,
});

const lesson = (over: Partial<SavedLesson> = {}): SavedLesson => ({
  picks: ["kana-row:h-w"],
  at: 2,
  steps: 7,
  star: "kana:わ",
  leftAt: 2000,
  ...over,
});

/** What storage would hand back: the document as JSON and home again. */
const roundTrip = (place: SavedPlace) => readPlace(JSON.parse(JSON.stringify(placeDoc(place))));

describe("a place, read back", () => {
  it("keeps a quiz and a lesson side by side", () => {
    const back = roundTrip({ quiz: run(), lesson: lesson() });
    assert.equal(back.quiz?.deck.length, 4);
    assert.equal(back.lesson?.star, "kana:わ");
    assert.equal(back.lesson?.at, 2);
  });

  it("is empty when there is nothing there", () => {
    assert.deepEqual(readPlace(null), NO_PLACE);
    assert.deepEqual(readPlace("a place"), NO_PLACE);
    assert.deepEqual(readPlace({}), NO_PLACE);
  });

  it("reads SAK-404's bare run as a place holding that quiz (the migration)", () => {
    // What a learner mid-run had in their browser and in their column on the
    // day SAK-444 shipped: a run, written with no version and no envelope.
    const back = readPlace(JSON.parse(JSON.stringify(run())));
    assert.equal(back.quiz?.deck.length, 4);
    assert.equal(back.quiz?.at, 2);
    assert.equal(back.lesson, null);
  });

  it("reads an old run too far gone as no quiz at all, the way it always did", () => {
    assert.deepEqual(readPlace({ deck: ["a"], answers: [answer("a")] }), NO_PLACE);
  });

  it("keeps a slot the document does not have", () => {
    const back = roundTrip({ quiz: null, lesson: lesson() });
    assert.equal(back.quiz, null);
    assert.equal(back.lesson?.steps, 7);
  });

  it("writes no document at all when nothing is left, so the column is cleared", () => {
    assert.equal(placeDoc(NO_PLACE), null);
  });

  it("leaves an empty slot out of the document rather than writing it null", () => {
    assert.deepEqual(placeDoc({ quiz: null, lesson: lesson() }), { v: 2, lesson: lesson() });
  });
});

describe("a saved lesson, read back", () => {
  it("is nothing without picks or a star", () => {
    assert.equal(roundTrip({ quiz: null, lesson: lesson({ picks: [] }) }).lesson, null);
    assert.equal(roundTrip({ quiz: null, lesson: lesson({ star: "" }) }).lesson, null);
  });

  it("is nothing on the first step: that lesson was opened and left", () => {
    assert.equal(readPlace({ v: 2, lesson: lesson({ at: 0 }) }).lesson, null);
  });

  it("is nothing when the step is outside the order it claims", () => {
    assert.equal(readPlace({ v: 2, lesson: lesson({ at: 9, steps: 7 }) }).lesson, null);
  });
});

describe("what is worth keeping after a step", () => {
  it("keeps a lesson part way through", () => {
    assert.deepEqual(lessonToKeep(["p"], 2, 7, "s", 5), { picks: ["p"], at: 2, steps: 7, star: "s", leftAt: 5 });
  });

  it("keeps nothing on the first step, which is where a lesson opens anyway", () => {
    assert.equal(lessonToKeep(["p"], 0, 7, "s", 5), null);
  });

  it("keeps the last step, because what is waiting there is the drill", () => {
    assert.equal(lessonToKeep(["p"], 6, 7, "s", 5)?.at, 6);
  });

  it("keeps nothing for a lesson of no picks", () => {
    assert.equal(lessonToKeep([], 2, 7, "s", 5), null);
  });
});

describe("whether a lesson is the one that was left", () => {
  it("matches the same picks in the same order", () => {
    assert.equal(samePicks(["a", "b"], ["a", "b"]), true);
    assert.equal(samePicks(["a", "b"], ["b", "a"]), false);
    assert.equal(samePicks(["a"], ["a", "b"]), false);
  });
});

describe("what Continue offers", () => {
  it("offers the newest of the two, which is the lesson here", () => {
    const entry = newestPlace({ quiz: run({ leftAt: 10 }), lesson: lesson({ leftAt: 20 }) });
    assert.equal(entry?.kind, "lesson");
    assert.equal(placeLabel(entry!), "Continue your lesson (step 3 of 7)");
  });

  it("offers the quiz when the quiz is the newer one", () => {
    const entry = newestPlace({ quiz: run({ leftAt: 30 }), lesson: lesson({ leftAt: 20 }) });
    assert.equal(entry?.kind, "quiz");
    assert.equal(placeLabel(entry!), "Continue your quiz (2 of 4)");
  });

  it("offers nothing when nothing was left", () => {
    assert.equal(newestPlace(NO_PLACE), null);
  });

  it("counts a lesson's step from one, the way the lesson itself does", () => {
    assert.equal(placeNote({ kind: "lesson", lesson: lesson({ at: 2, steps: 7 }) }), "step 3 of 7");
  });

  it("lists both, newest first, for the page that shows what is not on the button", () => {
    const rows = placeEntries({ quiz: run({ leftAt: 30 }), lesson: lesson({ leftAt: 20 }) });
    assert.deepEqual(rows.map((r) => r.kind), ["quiz", "lesson"]);
  });

  it("knows whether anything was left at all", () => {
    assert.equal(hasPlace(NO_PLACE), false);
    assert.equal(hasPlace({ quiz: null, lesson: lesson() }), true);
    assert.equal(hasPlace({ quiz: run(), lesson: null }), true);
  });
});

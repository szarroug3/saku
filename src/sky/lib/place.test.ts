import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  hasPlace,
  lessonAt,
  lessonFor,
  newestPlace,
  NO_PLACE,
  placeDoc,
  placeEntries,
  placeLabel,
  placeNote,
  readPlace,
  type LessonPart,
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

const steps: LessonPart = { kind: "steps", at: 2, steps: 7, star: "kana:わ" };

const lesson = (part: LessonPart = steps, leftAt = 2000): SavedLesson => ({ picks: ["kana-row:h-w"], part, leftAt });

/** What storage would hand back: the document as JSON and home again. */
const roundTrip = (place: SavedPlace) => readPlace(JSON.parse(JSON.stringify(placeDoc(place))));

describe("a place, read back", () => {
  it("keeps a quiz and a lesson side by side", () => {
    const back = roundTrip({ quiz: run(), lesson: lesson() });
    assert.equal(back.quiz?.deck.length, 4);
    assert.deepEqual(back.lesson?.part, steps);
  });

  it("is empty when there is nothing there", () => {
    assert.deepEqual(readPlace(null), NO_PLACE);
    assert.deepEqual(readPlace("a place"), NO_PLACE);
    assert.deepEqual(readPlace({}), NO_PLACE);
  });

  it("reads SAK-404's bare run as a place holding that quiz (the first migration)", () => {
    // What a learner mid-run had in their browser and in their column on the
    // day SAK-444 shipped: a run, written with no version and no envelope.
    const back = readPlace(JSON.parse(JSON.stringify(run())));
    assert.equal(back.quiz?.deck.length, 4);
    assert.equal(back.quiz?.at, 2);
    assert.equal(back.lesson, null);
  });

  it("reads version 2's lesson, which was a step and nothing else, as a sitting on its steps", () => {
    // The shape SAK-444 shipped first: no parts, the step written straight
    // onto the lesson. A learner three stars into a lesson keeps their place.
    const back = readPlace({ v: 2, quiz: run(), lesson: { picks: ["kana-row:h-w"], at: 2, steps: 7, star: "kana:わ", leftAt: 2000 } });
    assert.deepEqual(back.lesson?.part, steps);
    assert.equal(back.lesson?.leftAt, 2000);
    assert.equal(back.quiz?.deck.length, 4);
  });

  it("reads an old run too far gone as no quiz at all, the way it always did", () => {
    assert.deepEqual(readPlace({ deck: ["a"], answers: [answer("a")] }), NO_PLACE);
  });

  it("keeps a slot the document does not have", () => {
    const back = roundTrip({ quiz: null, lesson: lesson() });
    assert.equal(back.quiz, null);
    assert.equal(back.lesson?.picks.length, 1);
  });

  it("writes no document at all when nothing is left, so the column is cleared", () => {
    assert.equal(placeDoc(NO_PLACE), null);
  });

  it("leaves an empty slot out of the document rather than writing it null", () => {
    assert.deepEqual(placeDoc({ quiz: null, lesson: lesson() }), { v: 3, lesson: lesson() });
  });
});

describe("each part of the sitting, read back", () => {
  it("keeps the steps", () => {
    assert.deepEqual(roundTrip({ quiz: null, lesson: lesson() }).lesson?.part, steps);
  });

  it("keeps a lesson opened and left on its FIRST step, which version 2 threw away", () => {
    const first: LessonPart = { kind: "steps", at: 0, steps: 7, star: "kana:わ" };
    assert.deepEqual(roundTrip({ quiz: null, lesson: lesson(first) }).lesson?.part, first);
  });

  it("keeps a round with the run it was dealt and answered", () => {
    const part: LessonPart = { kind: "round", round: 2, run: run() };
    const back = roundTrip({ quiz: null, lesson: lesson(part) }).lesson?.part;
    assert.equal(back?.kind, "round");
    assert.equal(back?.kind === "round" && back.round, 2);
    assert.equal(back?.kind === "round" && back.run.answers.length, 2);
  });

  it("keeps a round whose cards nobody has answered yet, because opening the drill is being in it", () => {
    const part: LessonPart = { kind: "round", round: 1, run: run({ at: 0, answers: [] }) };
    assert.deepEqual(roundTrip({ quiz: null, lesson: lesson(part) }).lesson?.part, part);
  });

  it("keeps a break with its clock", () => {
    const part: LessonPart = { kind: "break", round: 1, startedAt: 500, until: 300_500 };
    assert.deepEqual(roundTrip({ quiz: null, lesson: lesson(part) }).lesson?.part, part);
  });

  it("is nothing without picks", () => {
    assert.equal(readPlace({ v: 3, lesson: { picks: [], part: steps, leftAt: 1 } }).lesson, null);
  });

  it("is nothing when a part is unreadable: no star, a step outside its order, a round of no cards", () => {
    assert.equal(readPlace({ v: 3, lesson: { picks: ["p"], part: { kind: "steps", at: 1, steps: 4 }, leftAt: 1 } }).lesson, null);
    assert.equal(readPlace({ v: 3, lesson: { picks: ["p"], part: { kind: "steps", at: 9, steps: 4, star: "s" }, leftAt: 1 } }).lesson, null);
    assert.equal(readPlace({ v: 3, lesson: { picks: ["p"], part: { kind: "round", round: 1, run: { deck: [] } }, leftAt: 1 } }).lesson, null);
  });
});

describe("what is worth keeping", () => {
  it("keeps the lesson at whichever part it is in", () => {
    assert.deepEqual(lessonAt(["p"], steps, 5), { picks: ["p"], part: steps, leftAt: 5 });
  });

  it("keeps nothing for a lesson of no picks", () => {
    assert.equal(lessonAt([], steps, 5), null);
  });
});

describe("whether the lesson slot holds this lesson", () => {
  it("matches the same picks in the same order", () => {
    const place: SavedPlace = { quiz: null, lesson: lesson() };
    assert.equal(lessonFor(place, ["kana-row:h-w"])?.leftAt, 2000);
    assert.equal(lessonFor(place, ["kana-row:h-vowels"]), null);
    assert.equal(lessonFor(place, ["kana-row:h-w", "kana-row:h-vowels"]), null);
    assert.equal(lessonFor(NO_PLACE, ["kana-row:h-w"]), null);
  });
});

describe("what Continue offers", () => {
  const NOW = 1_000_000;

  it("offers the newest of the two, which is the lesson here", () => {
    const entry = newestPlace({ quiz: run({ leftAt: 10 }), lesson: lesson(steps, 20) });
    assert.equal(entry?.kind, "lesson");
    assert.equal(placeLabel(entry!, NOW), "Continue your lesson (step 3 of 7)");
  });

  it("offers the quiz when the quiz is the newer one", () => {
    const entry = newestPlace({ quiz: run({ leftAt: 30 }), lesson: lesson(steps, 20) });
    assert.equal(entry?.kind, "quiz");
    assert.equal(placeLabel(entry!, NOW), "Continue your quiz (2 of 4)");
  });

  it("offers nothing when nothing was left", () => {
    assert.equal(newestPlace(NO_PLACE), null);
  });

  it("counts a lesson's step from one, the way the lesson itself does", () => {
    assert.equal(placeNote({ kind: "lesson", lesson: lesson() }, NOW), "step 3 of 7");
  });

  it("says which round and which card, for a lesson left in its drill", () => {
    const entry = { kind: "lesson", lesson: lesson({ kind: "round", round: 2, run: run() }) } as const;
    assert.equal(placeLabel(entry, NOW), "Continue your lesson (round 2, card 3 of 4)");
  });

  it("says which break and how much of it is left", () => {
    const entry = { kind: "lesson", lesson: lesson({ kind: "break", round: 1, startedAt: NOW, until: NOW + 150_000 }) } as const;
    assert.equal(placeLabel(entry, NOW), "Continue your lesson (break before round 2 of 3, 3 min left)");
  });

  it("rounds the last of a break up, because a clock still running never says zero", () => {
    const entry = { kind: "lesson", lesson: lesson({ kind: "break", round: 1, startedAt: NOW, until: NOW + 1_000 }) } as const;
    assert.equal(placeNote(entry, NOW), "break before round 2 of 3, 1 min left");
  });

  it("says the round itself once the break is over", () => {
    const entry = { kind: "lesson", lesson: lesson({ kind: "break", round: 2, startedAt: 0, until: NOW - 1 }) } as const;
    assert.equal(placeLabel(entry, NOW), "Continue your lesson (round 3 of 3)");
  });

  it("names the break without a clock while there is no browser to read one", () => {
    const entry = { kind: "lesson", lesson: lesson({ kind: "break", round: 1, startedAt: 0, until: NOW }) } as const;
    assert.equal(placeNote(entry, null), "break before round 2 of 3");
  });

  it("lists both, newest first, for the page that shows what is not on the button", () => {
    const rows = placeEntries({ quiz: run({ leftAt: 30 }), lesson: lesson(steps, 20) });
    assert.deepEqual(rows.map((r) => r.kind), ["quiz", "lesson"]);
  });

  it("knows whether anything was left at all", () => {
    assert.equal(hasPlace(NO_PLACE), false);
    assert.equal(hasPlace({ quiz: null, lesson: lesson() }), true);
    assert.equal(hasPlace({ quiz: run(), lesson: null }), true);
  });
});

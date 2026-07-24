// Run: node --import ./src/lib/conjugate/test-hooks.mjs --test \
//        src/lib/history-writes.test.ts
//
// THE BUG
// =======
// Clicking "I already know these" took about two seconds to do anything. The
// handler was:
//
//     await postClaim(facts, true);   // round trip 1
//     await refresh();                // round trip 2 — the WHOLE history back
//
// so the card could not advance until the server had been told and then asked.
// Starting a lesson was the same shape, which is why its button flipped to
// Continue and then hung: the label is local, the navigation was not.
//
// WHAT THESE TESTS PIN
// ====================
// The fix is to apply the write to the copy on screen with the same pure op the
// server applies, and post in the background. That is only legitimate if the
// local apply is genuinely SUFFICIENT — if the screen can reach its next state
// without the server's answer. So these tests do not check that a function was
// called or that a promise was not awaited; they check the property that makes
// the whole thing safe:
//
//   applying the op locally moves the curriculum exactly as far as a round trip
//   through the server would have.
//
// If that ever stops being true — if some part of "what does claiming mean"
// moves into the API route and out of history-ops — these fail, and they fail
// with the reason rather than with a hang.
//
// Nothing here touches the network. That is the point: the computation under
// test is the one that now runs on the client, and it is pure.

import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { nextCurriculumLesson } from "@/lib/curriculum-lesson";
import { LESSON_RANGE_DEFAULT } from "@/lib/lesson-sizing";
import { applyClaims, applySeen, emptyHistory } from "@/lib/history-ops";
import { meaningFactId } from "@/data/kanji";

const RANGE = LESSON_RANGE_DEFAULT;

describe("the local apply is enough to advance the curriculum", () => {
  test("claiming the first lesson moves the card on, with no server in the loop", () => {
    const first = nextCurriculumLesson(emptyHistory(), RANGE);
    assert.ok(first, "a new learner has a first lesson");

    // The ONE call the click now makes before the screen re-renders.
    const after = applyClaims(emptyHistory(), first.facts, 1_000);
    const second = nextCurriculumLesson(after, RANGE);

    assert.ok(second, "there is a lesson after the first");
    assert.notDeepEqual(
      second.facts,
      first.facts,
      "the card advanced off the lesson that was just claimed",
    );
  });

  test("and it keeps advancing, so this is not a one-step illusion", () => {
    // Three claims in a row, all local. If the local apply were only partially
    // right the sequence would stall or repeat, and a single-step assertion
    // would not catch it.
    let hist = emptyHistory();
    const seen: string[][] = [];
    for (let i = 0; i < 3; i++) {
      const lesson = nextCurriculumLesson(hist, RANGE);
      assert.ok(lesson, `lesson ${i} exists`);
      seen.push([...lesson.facts]);
      hist = applyClaims(hist, lesson.facts, 1_000 + i);
    }
    const keys = seen.map((f) => f.join("|"));
    assert.equal(new Set(keys).size, 3, "three distinct lessons, no repeat");
  });

  test("a claim is not a seen record — the two writes stay different writes", () => {
    // Both are optimistic now, and both go through the same `apply`. That makes
    // it cheap to accidentally route one through the other's op, which would be
    // invisible on screen (the card advances either way) and wrong in the file.
    const first = nextCurriculumLesson(emptyHistory(), RANGE);
    assert.ok(first);
    const claimed = applyClaims(emptyHistory(), first.facts, 1_000);
    const seen = applySeen(emptyHistory(), first.facts, 1_000);
    assert.notDeepEqual(claimed, seen);
    assert.ok(claimed.claims, "a claim writes claims");
    assert.equal(seen.claims, undefined, "a seen record does not");
  });

  test("the op does not mutate the history it was handed", () => {
    // The provider applies these inside a setState updater, so a mutation would
    // be an in-place edit of React state: the screen would go stale in a way
    // that only shows up as a missing re-render, which is exactly the class of
    // bug this whole change is meant to remove rather than add.
    const kanjiMeaningFact = meaningFactId("一");
    const before = emptyHistory();
    const snapshot = JSON.stringify(before);
    applyClaims(before, [kanjiMeaningFact], 1_000);
    applySeen(before, [kanjiMeaningFact], 1_000);
    assert.equal(JSON.stringify(before), snapshot);
  });
});

// The lesson holds still once it is open (SAK-446).
//
// Opening a star marks its facts seen, and seen is also what makes a star one
// the learner already has, so the rail's split (SAK-416) moved the star the
// learner had just opened out of "Tonight, in order" and into References, and
// "Step 1 of 5" became "Step 1 of 4". The build reads the learner as they were
// before tonight opened anything, so none of it moves.

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { applyClaims, applySeen, emptyHistory } from "@/lib/history-ops";
import { buildGraph } from "@/sky/lib/graph";
import { lessonSteps } from "@/sky/lib/lesson";
import type { HistoryFile } from "@/types/store";

import { lessonFromPicks } from "./lesson";
import { pickFacts } from "./observatory";
import { sampleHistory } from "./sample-learner";

const NOW = Date.UTC(2026, 8, 16);
const ROW = "kana-row:h-vowels";

const lesson = (history: HistoryFile) => lessonFromPicks(history, [ROW], NOW);

/** What "Tonight, in order" lists, which is also what "Step n of N" counts:
 * the page runs the Sky's own `lessonSteps` over the payload, so this does. */
function steps(data: ReturnType<typeof lessonFromPicks>): string[] {
  return lessonSteps(buildGraph(data.items), data.picks, new Set(data.learned)).map((s) => s.id);
}

/** What the References panel lists. Pages are the terms and intros behind
 * tonight; a bare id is a star already in the sky. */
const references = (data: ReturnType<typeof lessonFromPicks>) => (data.references ?? []).map((r) => r.id);
const knownStars = (data: ReturnType<typeof lessonFromPicks>) => references(data).filter((id) => !id.startsWith("page:"));

describe("a star opened tonight stays in the order", () => {
  const fresh = emptyHistory();
  const opening = lesson(fresh);
  const first = steps(opening);

  it("teaches the whole row to a learner with nothing", () => {
    assert.equal(first.length, 5);
    assert.deepEqual(knownStars(opening), []);
  });

  it("keeps the count and the order when one of tonight's stars is marked seen", () => {
    // what opening the second star does, exactly: seeId marks its facts seen
    const seen = applySeen(fresh, pickFacts([first[1]]), NOW);
    const again = lesson(seen);
    // N is what the header counts, and it lost a step on every Next
    assert.equal(steps(again).length, first.length);
    assert.deepEqual(steps(again), first);
    assert.ok(!knownStars(again).includes(first[1]), "the opened star must not become a reference");
  });

  it("holds when every star of the lesson has been opened", () => {
    let seen = fresh;
    for (const id of first) seen = applySeen(seen, pickFacts([id]), NOW);
    const again = lesson(seen);
    assert.equal(steps(again).length, 5, "N never changes while a lesson is open");
    assert.deepEqual(steps(again), first);
    assert.deepEqual(knownStars(again), []);
  });

  it("keeps the terms and intros behind tonight too", () => {
    // the walk reads history as well, so it stopped offering the terms a
    // learner had just been shown: they vanished from References mid-lesson
    assert.ok(references(opening).some((id) => id.startsWith("page:")), "a fresh learner meets the terms behind kana");
    const seen = applySeen(fresh, pickFacts([first[1]]), NOW);
    assert.deepEqual(references(lesson(seen)), references(opening));
  });
});

describe("a lesson with nothing to rest on", () => {
  it("has no references at all when a piece is picked on its own", () => {
    // what the two-by-two's empty top right cell is for: the sample learner
    // picking a primitive meets no term and rests on nothing (SAK-446)
    const data = lessonFromPicks(sampleHistory(NOW), ["primitive:圭"], NOW);
    assert.equal(steps(data).length, 1);
    assert.deepEqual(data.references, []);
  });
});

describe("what the learner really has is still a reference", () => {
  const fresh = emptyHistory();
  const all = steps(lesson(fresh));

  it("keeps a claimed star out of the order and in the references", () => {
    const claimed = applyClaims(fresh, pickFacts([all[0]]), NOW);
    const data = lesson(claimed);
    assert.deepEqual(steps(data), all.slice(1));
    assert.ok(knownStars(data).includes(all[0]), "a claimed star is in the sky already");
  });
});

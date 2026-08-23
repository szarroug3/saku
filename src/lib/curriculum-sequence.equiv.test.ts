// THE SAFETY NET for curriculum-sequence.json — asserts the precomputed
// CURRICULUM_SEQUENCE, curriculumPosition and curriculumReadingPosition match
// the live computation in curriculum-order.ts for every item, since
// server-lookups.ts's chain, engine/question.ts, content/verb-pair-unit.ts,
// content/unit-tracks.ts, difficulty.ts and curriculum-lesson.ts all now read
// from here instead of re-running buildSequence() on every cold start / client
// bundle load.
//
// The point is "frozen artifact === live computation", not "matches some fixed
// algorithm" — SAK-161 made this a pure refactor (CONTENTS and ORDER unchanged,
// only WHERE computed); SAK-162 changed the algorithm itself (one item per
// taught word READING, not per word — curriculum-order.ts's header), and this
// test was updated to compare against THAT live output, whatever it is. Any
// drift here means a stale build artifact — run
// `pnpm run build:curriculum-sequence`.
//
// A glyph can occupy more than one position now (a word taught with more than
// one reading, 七 as しち and again as なな), so `curriculumPosition` — which
// answers "where does this glyph FIRST become taught" — can no longer be
// checked against every index the glyph appears at; it agrees only with the
// FIRST one. `curriculumReadingPosition` is what checks every one of a
// multi-reading word's own positions individually.

import { test } from "node:test";
import assert from "node:assert/strict";

import { CURRICULUM_SEQUENCE as LIVE_SEQUENCE } from "@/lib/curriculum-order";
import {
  CURRICULUM_SEQUENCE,
  curriculumPosition,
  curriculumReadingPosition,
} from "@/lib/curriculum-sequence";

test("CURRICULUM_SEQUENCE matches the live curriculum-order.ts computation, byte for byte", () => {
  assert.equal(CURRICULUM_SEQUENCE.length, LIVE_SEQUENCE.length);
  for (let i = 0; i < LIVE_SEQUENCE.length; i++) {
    assert.deepEqual(CURRICULUM_SEQUENCE[i], LIVE_SEQUENCE[i], `item ${i}`);
  }
});

test("curriculumPosition matches the live curriculum-order.ts FIRST position for every glyph", () => {
  const firstIndexOf = new Map<string, number>();
  for (let i = 0; i < LIVE_SEQUENCE.length; i++) {
    const glyph = LIVE_SEQUENCE[i].glyph;
    if (!firstIndexOf.has(glyph)) firstIndexOf.set(glyph, i);
  }
  for (const [glyph, i] of firstIndexOf) {
    assert.equal(curriculumPosition(glyph), i, `glyph ${glyph}`);
  }
});

test("curriculumReadingPosition matches the live curriculum-order.ts position for every (word, reading) item", () => {
  for (let i = 0; i < LIVE_SEQUENCE.length; i++) {
    const item = LIVE_SEQUENCE[i];
    if (item.reading === null) continue;
    assert.equal(
      curriculumReadingPosition(item.glyph, item.reading),
      i,
      `${item.glyph}/${item.reading}`,
    );
  }
});

test("curriculumPosition is -1 for a glyph the curriculum does not teach", () => {
  assert.equal(curriculumPosition("not-a-real-glyph-xyz"), -1);
});

test("curriculumReadingPosition is -1 for a reading the curriculum does not teach", () => {
  assert.equal(curriculumReadingPosition("七", "not-a-real-reading"), -1);
  assert.equal(curriculumReadingPosition("not-a-real-glyph-xyz", "なな"), -1);
});

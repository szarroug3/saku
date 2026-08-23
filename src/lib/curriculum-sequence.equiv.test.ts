// THE SAFETY NET for curriculum-sequence.json — asserts the precomputed
// CURRICULUM_SEQUENCE and curriculumPosition match the live computation in
// curriculum-order.ts for every item, since server-lookups.ts's chain,
// engine/question.ts, content/verb-pair-unit.ts, content/unit-tracks.ts,
// difficulty.ts and curriculum-lesson.ts all now read from here instead of
// re-running buildSequence() on every cold start / client bundle load.
//
// SAK-161 is a pure refactor: the sequence's CONTENTS and ORDER must be
// byte-identical to what curriculum-order.ts computes live. Any drift here
// means a stale build artifact — run `pnpm run build:curriculum-sequence`.

import { test } from "node:test";
import assert from "node:assert/strict";

import { CURRICULUM_SEQUENCE as LIVE_SEQUENCE } from "@/lib/curriculum-order";
import {
  CURRICULUM_SEQUENCE,
  curriculumPosition,
} from "@/lib/curriculum-sequence";

test("CURRICULUM_SEQUENCE matches the live curriculum-order.ts computation, byte for byte", () => {
  assert.equal(CURRICULUM_SEQUENCE.length, LIVE_SEQUENCE.length);
  for (let i = 0; i < LIVE_SEQUENCE.length; i++) {
    assert.deepEqual(CURRICULUM_SEQUENCE[i], LIVE_SEQUENCE[i], `item ${i}`);
  }
});

test("curriculumPosition matches the live curriculum-order.ts position for every glyph", () => {
  for (let i = 0; i < LIVE_SEQUENCE.length; i++) {
    const glyph = LIVE_SEQUENCE[i].glyph;
    assert.equal(curriculumPosition(glyph), i, `glyph ${glyph}`);
  }
});

test("curriculumPosition is -1 for a glyph the curriculum does not teach", () => {
  assert.equal(curriculumPosition("not-a-real-glyph-xyz"), -1);
});

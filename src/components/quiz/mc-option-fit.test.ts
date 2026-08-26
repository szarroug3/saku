// Run:
//   node --import ./src/lib/conjugate/test-hooks.mjs --test src/components/quiz/mc-option-fit.test.ts
//
// SAK-207: pins the pure sizing math behind McOptionGrid's `size="lg"`
// shrink-to-fit. The actual DOM measurement (ref + useLayoutEffect,
// ResizeObserver) isn't covered here — see mc-option-fit.ts's header comment
// for why that half of the fix has no meaningful headless-node test.

import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  fitFontSizeRem,
  MC_OPTION_MAX_FONT_REM,
  MC_OPTION_MIN_FONT_REM,
} from "./mc-option-fit.ts";

describe("fitFontSizeRem", () => {
  test("a short option that already fits stays at the max size", () => {
    // 〜てから rendered narrower than its tile — nothing to shrink.
    assert.equal(fitFontSizeRem(60, 120), MC_OPTION_MAX_FONT_REM);
  });

  test("text exactly at the boundary stays at the max size", () => {
    assert.equal(fitFontSizeRem(120, 120), MC_OPTION_MAX_FONT_REM);
  });

  test("a long option scales down proportionally to the overflow", () => {
    // Natural width is 1.25x the available space, close enough to the max
    // size that the target still lands above the floor — the reported
    // SAK-207 case (〜てはいけない overflowing its tile) is this shape: scale
    // down by the same ratio the text is too wide by, not clamp straight to
    // the floor.
    const result = fitFontSizeRem(150, 120);
    const expected = MC_OPTION_MAX_FONT_REM * (120 / 150);
    assert.ok(expected > MC_OPTION_MIN_FONT_REM, "test setup should land above the floor");
    assert.equal(result, expected);
  });

  test("an extremely long option is clamped to the floor, not shrunk indefinitely", () => {
    // Wildly overflowing (10x too wide) would compute a font size far below
    // readable if left unclamped.
    const result = fitFontSizeRem(1200, 120);
    assert.equal(result, MC_OPTION_MIN_FONT_REM);
  });

  test("the floor matches this file's own size=\"sm\" token", () => {
    // Not an arbitrary number — see mc-option-fit.ts's comment on why the
    // floor is text-sm rather than a new smallest size.
    assert.equal(MC_OPTION_MIN_FONT_REM, 0.875);
  });

  test("zero or negative measurements fall back to the max size", () => {
    // Guards the pre-layout call (refs measured before the browser has laid
    // anything out yet) rather than dividing by zero or going negative.
    assert.equal(fitFontSizeRem(0, 120), MC_OPTION_MAX_FONT_REM);
    assert.equal(fitFontSizeRem(180, 0), MC_OPTION_MAX_FONT_REM);
    assert.equal(fitFontSizeRem(-10, 120), MC_OPTION_MAX_FONT_REM);
  });

  test("custom max/min bounds are respected", () => {
    assert.equal(fitFontSizeRem(300, 100, 2, 1), 1);
    assert.equal(fitFontSizeRem(150, 100, 2, 1), 2 * (100 / 150));
  });
});

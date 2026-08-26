// Run:
//   node --import ./src/lib/conjugate/test-hooks.mjs --test src/components/quiz/mc-option-fit.test.ts
//
// SAK-207: pins the pure sizing math behind McOptionGrid's `size="lg"`
// shrink-to-fit. The actual DOM measurement (ref + useLayoutEffect,
// ResizeObserver) isn't covered here — see mc-option-fit.ts's header comment
// for why that half of the fix has no meaningful headless-node test.
//
// Round 3 adds shrinkFontToFitHeight's SEARCH MECHANICS (start point, step
// size, floor, iteration cap, early exit) via a fake measureHeightPx — same
// split: the search logic is pure and testable, the real scrollHeight read
// that drives it in mc-option-grid.tsx isn't.

import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  fitFontSizeRem,
  MC_OPTION_MAX_FONT_REM,
  MC_OPTION_MAX_SHRINK_STEPS,
  MC_OPTION_MIN_FONT_REM,
  MC_OPTION_SHRINK_STEP_REM,
  MC_OPTION_TILE_HEIGHT_REM,
  shrinkFontToFitHeight,
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

describe("MC_OPTION_TILE_HEIGHT_REM (SAK-207 round 3)", () => {
  test("comfortably covers the 3-line floor budget it's derived from", () => {
    // Mirrors the arithmetic in mc-option-fit.ts's header comment: text-xl's
    // own line-height ratio (1.75/1.25 = 1.4) applies to whatever font-size
    // is actually in effect, including once shrunk to the floor — so a line
    // at the floor is MC_OPTION_MIN_FONT_REM x 1.4 tall, not text-sm's own
    // (slightly different) line-height.
    const lineHeightAtFloorRem = MC_OPTION_MIN_FONT_REM * (1.75 / 1.25);
    const threeLinesRem = lineHeightAtFloorRem * 3;
    // gap-1 + the index sub-label (10px x Preflight's 1.5 line-height) +
    // py-2 + the tile's 1px border on both edges, all in rem.
    const chromeRem = 0.25 + 0.9375 + 1 + 0.125;
    const requiredRem = threeLinesRem + chromeRem;

    assert.ok(
      requiredRem <= MC_OPTION_TILE_HEIGHT_REM,
      `the derived requirement (${requiredRem}rem) must fit inside the chosen height (${MC_OPTION_TILE_HEIGHT_REM}rem)`,
    );
    assert.ok(
      MC_OPTION_TILE_HEIGHT_REM - requiredRem < 0.5,
      "the rounding buffer should be small (font-metric slack), not an arbitrary round number",
    );
  });

  test("is expressed as a real number, matching the literal h-[6.25rem] class in mc-option-grid.tsx", () => {
    // Tailwind's build-time scanner needs a literal class string, so this
    // constant can't be interpolated into the JSX directly — this pins the
    // one thing that CAN drift silently: the two numbers disagreeing.
    assert.equal(MC_OPTION_TILE_HEIGHT_REM, 6.25);
  });
});

describe("shrinkFontToFitHeight", () => {
  test("an option that already fits at the starting size measures once and doesn't shrink", () => {
    let calls = 0;
    const measure = (_rem: number) => {
      calls++;
      return 10; // always comfortably under availableHeightPx
    };
    const result = shrinkFontToFitHeight(measure, 1.1, 100);
    assert.equal(result, 1.1);
    assert.equal(calls, 1, "should not keep measuring once it already fits");
  });

  test("steps down until the wrapped height fits, then stops", () => {
    // Models a real step-function: line count (and so height) only drops
    // once the font shrinks past a threshold — text doesn't gradually get
    // "less wrapped".
    let calls = 0;
    const measure = (rem: number) => {
      calls++;
      return rem > 1.0 ? 200 : 120; // 3 lines above 1.0rem, 2 lines at/below
    };
    const result = shrinkFontToFitHeight(measure, MC_OPTION_MAX_FONT_REM, 150);
    assert.ok(result <= 1.0, "should have stepped down to the 2-line size");
    assert.ok(
      result > MC_OPTION_MIN_FONT_REM,
      "should stop as soon as it fits, not fall all the way to the floor",
    );
    assert.ok(calls > 1, "a real step-function fit needs more than one measurement");
  });

  test("an option that never fits, even at the floor, clamps to the floor rather than looping forever", () => {
    let calls = 0;
    const measure = (_rem: number) => {
      calls++;
      return 999; // never fits, at any size
    };
    const result = shrinkFontToFitHeight(measure, 1.0, 100, 0.8, 0.1, 10);
    assert.equal(result, 0.8, "should clamp to the floor, not undershoot it");
    // 1.0 -> 0.9 -> 0.8 (hits the floor and returns on that measurement) = 3
    // calls, well under the 10-step cap — the floor itself ends the search.
    assert.equal(calls, 3);
  });

  test("the iteration cap bounds total measurements even when the floor is never reached", () => {
    let calls = 0;
    const measure = (_rem: number) => {
      calls++;
      return 999; // never fits
    };
    // stepRem doesn't evenly divide (startRem - minRem), so the floor would
    // never be hit exactly within maxSteps — the cap must still bound calls.
    const result = shrinkFontToFitHeight(measure, 1.25, 0, 0.875, 0.1, 2);
    assert.equal(calls, 2, "must never exceed maxSteps measurements");
    // 1.25 -> 1.15 -> 1.05, two steps taken. `ok`, not `equal`: 0.1 isn't
    // exactly representable in binary floating point, so repeated
    // subtraction drifts by a few ULPs (1.0499999999999998, not 1.05).
    assert.ok(
      Math.abs(result - 1.05) < 1e-9,
      `expected ~1.05, got ${result}`,
    );
  });

  test("clamps an out-of-range startRem into [minRem, MC_OPTION_MAX_FONT_REM] before measuring", () => {
    const seenRems: number[] = [];
    const measure = (rem: number) => {
      seenRems.push(rem);
      return 0; // fits immediately, so this is the only measurement
    };
    shrinkFontToFitHeight(measure, 999, 100);
    assert.equal(seenRems[0], MC_OPTION_MAX_FONT_REM);

    seenRems.length = 0;
    shrinkFontToFitHeight(measure, -5, 100);
    assert.equal(seenRems[0], MC_OPTION_MIN_FONT_REM);
  });

  test("default step size comfortably covers the full max-to-min range within the default step cap", () => {
    const fullRange = MC_OPTION_MAX_FONT_REM - MC_OPTION_MIN_FONT_REM;
    const stepsNeeded = Math.ceil(fullRange / MC_OPTION_SHRINK_STEP_REM);
    assert.ok(
      stepsNeeded <= MC_OPTION_MAX_SHRINK_STEPS,
      `worst-case ${stepsNeeded} steps must fit within the ${MC_OPTION_MAX_SHRINK_STEPS}-step cap`,
    );
  });
});

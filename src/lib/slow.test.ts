// Run: node --import ./src/lib/conjugate/test-hooks.mjs --test src/lib/slow.test.ts
//
// slow.ts decides whether an answer counts as a HESITATION, judged against your
// own recent latencies. The design promises are: "not enough data" is a real
// answer (null / false, never a guessed flag), the threshold is robust to a few
// huge outliers (MAD, not stdev), and the window tracks who you are NOW.

import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { BEHAVIOR } from "@/lib/config";
import { isSlow, mad, median, recordLatency, slowThreshold } from "@/lib/slow";

describe("median", () => {
  test("null for no data — not zero", () => {
    assert.equal(median([]), null);
  });
  test("middle of an odd list, mean of the two middles of an even list", () => {
    assert.equal(median([3, 1, 2]), 2);
    assert.equal(median([1, 2, 3, 4]), 2.5);
  });
});

describe("mad — median absolute deviation, robust to outliers", () => {
  test("null for no data", () => {
    assert.equal(mad([]), null);
  });
  test("a handful of huge outliers leave it unmoved", () => {
    // median is 3; |x-3| = [2,1,0,1,2] -> mad 1. Now blow up the tail:
    assert.equal(mad([1, 2, 3, 4, 5]), 1);
    assert.equal(mad([1, 2, 3, 4, 100000]), 1);
  });
});

describe("slowThreshold — null until there is enough history to be honest", () => {
  const floor = 500;

  test("fewer than slowMinSamples → null (flagging on noise is worse than not)", () => {
    const few = Array(BEHAVIOR.slowMinSamples - 1).fill(1000);
    assert.equal(slowThreshold(few, floor), null);
  });

  test("enough samples → median + k·MAD, but never below the floor", () => {
    // All identical: median = v, mad = 0, so threshold = max(floor, v).
    const flat = Array(BEHAVIOR.slowMinSamples).fill(1000);
    assert.equal(slowThreshold(flat, floor), 1000);
    // Below the floor: a fast, consistent learner still can't be flagged under it.
    const fast = Array(BEHAVIOR.slowMinSamples).fill(100);
    assert.equal(slowThreshold(fast, floor), floor);
  });

  test("the MAD multiplier widens the band above the median", () => {
    const xs = [...Array(BEHAVIOR.slowMinSamples - 1).fill(1000), 1000, 1200, 800];
    const t = slowThreshold(xs, 0);
    const m = median(xs)!;
    const d = mad(xs)!;
    assert.equal(t, m + BEHAVIOR.slowMadMultiplier * d);
  });
});

describe("isSlow — false whenever there is no basis to judge", () => {
  const floor = 500;
  test("false when the window is empty or too short", () => {
    assert.equal(isSlow(9999, {}, "typed", floor), false);
    assert.equal(isSlow(9999, { typed: [1000, 1000] }, "typed", floor), false);
  });
  test("judges per style — a slow typed answer is not judged against mc latencies", () => {
    const window = { typed: Array(BEHAVIOR.slowMinSamples).fill(1000) };
    assert.equal(isSlow(3000, window, "typed", floor), true);
    // No mc history at all → cannot judge an mc answer.
    assert.equal(isSlow(3000, window, "mc", floor), false);
  });
  test("at or below the threshold is not slow; strictly above is", () => {
    const window = { typed: Array(BEHAVIOR.slowMinSamples).fill(1000) };
    assert.equal(isSlow(1000, window, "typed", floor), false);
    assert.equal(isSlow(1001, window, "typed", floor), true);
  });
});

describe("recordLatency — a bounded rolling window, purely", () => {
  test("appends without mutating the input", () => {
    const w = { typed: [1, 2] };
    const next = recordLatency(w, "typed", 3);
    assert.deepEqual(next.typed, [1, 2, 3]);
    assert.deepEqual(w.typed, [1, 2], "input untouched");
  });
  test("trims to the newest slowWindow samples", () => {
    let w = {};
    for (let i = 0; i < BEHAVIOR.slowWindow + 10; i++) w = recordLatency(w, "mc", i);
    const mc = (w as { mc: number[] }).mc;
    assert.equal(mc.length, BEHAVIOR.slowWindow);
    assert.equal(mc.at(-1), BEHAVIOR.slowWindow + 9, "kept the newest");
    assert.equal(mc[0], 10, "dropped the oldest");
  });
  test("keeps the two styles separate", () => {
    const w = recordLatency(recordLatency({}, "typed", 1), "mc", 2);
    assert.deepEqual(w, { typed: [1], mc: [2] });
  });
});

// Run: node --import ./src/lib/conjugate/test-hooks.mjs --test src/components/results/summary.test.ts
//
// WHAT THIS PINS
// ==============
// summary.runAggregate's docstring promises that the results ring, the drill
// HUD pill you just watched, and the numbers Home shows tomorrow are "the same
// measurement". It was a promise the file did not keep: the ring pooled
// `firstTryCorrect === true ? 1 : 0` — a flag — over `seen`, which counts
// showings, so it drifted from the pill by more the harder you had practised.
//
// Three code paths, three modules, one number. This file is the promise.

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { deriveRun } from "@/components/results/summary";
import { accuracyOf, totalFor } from "@/lib/accuracy";
import { foldSessions } from "@/lib/aggregate";
import { sessionAccuracy } from "@/lib/session-accuracy";
import type {
  FactId,
  FactSessionDetail,
  QuizSessionRecord,
  SessionFactCounts,
  SessionStats,
} from "@/types";

const f = (s: string): FactId => s as FactId;

function detail(over: Partial<FactSessionDetail> = {}): FactSessionDetail {
  return {
    seen: 1,
    misses: 0,
    everCorrect: true,
    firstTryCorrect: true,
    firstTryCount: 1,
    correct: 1,
    slow: 0,
    confused: {},
    ...over,
  };
}

/** The write rule from quiz-session.writeRecord, which lives in a .tsx the
 * runner cannot load. One line per field; if writeRecord drifts from this, the
 * agreement below is the thing that stops being true in the app. */
function writeRecord(stats: SessionStats, ts: number): QuizSessionRecord {
  const facts: Record<FactId, SessionFactCounts> = {};
  for (const key of Object.keys(stats)) {
    const c = key as FactId;
    const st = stats[c];
    facts[c] = {
      seen: st.seen,
      missed: st.misses,
      slow: st.slow,
      firstTry: st.firstTryCount,
      correct: st.correct || (st.everCorrect ? 1 : 0),
      firstTryHit: st.firstTryCorrect === true,
    };
  }
  return {
    ts,
    mode: "drill",
    redrill: false,
    total: Object.keys(stats).length,
    forgivingPct: 0,
    strictPct: 0,
    facts,
  };
}

/** What Home reads tomorrow: the durable aggregate, pooled by the same
 * accuracy.totalFor a deck ring uses. */
function durableAccuracy(stats: SessionStats): number | null {
  const facts = foldSessions([writeRecord(stats, 1_700_000_000_000)]);
  const ids = Object.keys(facts) as FactId[];
  return accuracyOf(totalFor({ facts }, ids), "firstTry");
}

const ring = (stats: SessionStats) =>
  deriveRun(
    { mode: "drill", redrill: false, ts: 0, stats },
    "firstTry",
  ).pct;

const pill = (stats: SessionStats) => sessionAccuracy(stats, "firstTry");

describe("the ring, the pill and the durable aggregate are one measurement", () => {
  // A REAL RUN, of the shape endless mode actually produces: some facts came
  // round once, some several times, one was fumbled cold and only landed on the
  // requeue. 14 showings, 11 of them nailed first try.
  const run: SessionStats = {
    [f("a")]: detail({ seen: 4, firstTryCount: 4 }),
    [f("b")]: detail({ seen: 3, firstTryCount: 3 }),
    [f("c")]: detail({ seen: 1, firstTryCount: 1 }),
    [f("d")]: detail({
      seen: 3,
      firstTryCount: 1,
      misses: 2,
      firstTryCorrect: false,
      correct: 3,
    }),
    [f("e")]: detail({
      seen: 3,
      firstTryCount: 2,
      misses: 1,
      firstTryCorrect: true,
      correct: 3,
    }),
  };

  it("agrees to the number", () => {
    // 11 first-try showings out of 14 = 79%. accuracyOf reports 0–100.
    assert.equal(Math.round((100 * 11) / 14), 79);
    assert.equal(pill(run), 79);
    assert.equal(ring(run), 79);
    assert.equal(durableAccuracy(run), 79);
  });

  it("the flag-over-showings reading disagreed with all three", () => {
    // What the ring used to compute: 4 facts with firstTryCorrect true, over
    // the same 14 showings. 28.6% adrift, and adrift downward.
    const old = Math.round((100 * 4) / 14); // 29%
    assert.equal(old, 29);
    assert.notEqual(old, 79);
  });

  it("a perfect run reads 100% on all three, however much it repeated", () => {
    const perfect: SessionStats = {
      [f("a")]: detail({ seen: 6, firstTryCount: 6 }),
      [f("b")]: detail({ seen: 2, firstTryCount: 2 }),
    };
    assert.equal(pill(perfect), 100);
    assert.equal(ring(perfect), 100);
    assert.equal(durableAccuracy(perfect), 100);
  });

  it("a run where nothing landed cold reads 0 on all three", () => {
    const none: SessionStats = {
      [f("a")]: detail({
        seen: 3,
        firstTryCount: 0,
        misses: 3,
        firstTryCorrect: false,
        correct: 3,
      }),
    };
    assert.equal(pill(none), 0);
    assert.equal(ring(none), 0);
    assert.equal(durableAccuracy(none), 0);
  });
});

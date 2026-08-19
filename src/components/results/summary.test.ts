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

import { deriveRun, summarize } from "@/components/results/summary";
import { accuracyOf, totalFor } from "@/lib/accuracy";
import { foldSessions } from "@/lib/aggregate";
import { sessionAccuracy } from "@/lib/session-accuracy";
import type {
  FactId,
  FactSessionDetail,
  HistoryFile,
  QuizSessionRecord,
  SessionFactCounts,
  SessionStats,
} from "@/types";

const f = (s: string): FactId => s as FactId;

function detail(over: Partial<FactSessionDetail> = {}): FactSessionDetail {
  const firstTryCount = over.firstTryCount ?? 1;
  return {
    seen: 1,
    misses: 0,
    everCorrect: true,
    firstTryCorrect: true,
    firstTryCount,
    // A first-try showing is always a correct one, so this is the honest
    // default absent other evidence; callers with retries override it.
    correct: firstTryCount,
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
  return accuracyOf(totalFor({ facts }, ids));
}

const ring = (stats: SessionStats) =>
  deriveRun(
    { mode: "drill", redrill: false, ts: 0, stats },
  ).pct;

const pill = (stats: SessionStats) => sessionAccuracy(stats);

describe("the ring, the pill and the durable aggregate are one measurement", () => {
  // A REAL RUN, of the shape endless mode actually produces: some facts came
  // round once, some several times, one needed retries and still cost a
  // showing it never landed. 14 showings, 13 of them correct.
  const run: SessionStats = {
    [f("a")]: detail({ seen: 4, firstTryCount: 4 }),
    [f("b")]: detail({ seen: 3, firstTryCount: 3 }),
    [f("c")]: detail({ seen: 1, firstTryCount: 1 }),
    [f("d")]: detail({
      seen: 3,
      firstTryCount: 1,
      misses: 2,
      firstTryCorrect: false,
      correct: 2,
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
    // 13 correct showings out of 14 = 93%. accuracyOf reports 0–100.
    assert.equal(Math.round((100 * 13) / 14), 93);
    assert.equal(pill(run), 93);
    assert.equal(ring(run), 93);
    assert.equal(durableAccuracy(run), 93);
  });

  it("the flag-over-showings reading disagreed with all three", () => {
    // What the ring used to compute: 4 facts with firstTryCorrect true, over
    // the same 14 showings. Nowhere near the showing-level reading.
    const old = Math.round((100 * 4) / 14); // 29%
    assert.equal(old, 29);
    assert.notEqual(old, 93);
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

  it("a run where nothing ever landed reads 0 on all three", () => {
    const none: SessionStats = {
      [f("a")]: detail({
        seen: 3,
        firstTryCount: 0,
        misses: 3,
        firstTryCorrect: false,
        everCorrect: false,
        correct: 0,
      }),
    };
    assert.equal(pill(none), 0);
    assert.equal(ring(none), 0);
    assert.equal(durableAccuracy(none), 0);
  });

  it("categorizes mixed facts correctly by firstTry accuracy", () => {
    const mixed: SessionStats = {
      [f("a")]: detail({
        seen: 2,
        misses: 1,
        everCorrect: true,
        firstTryCorrect: true,
        firstTryCount: 1,
        correct: 2,
      }),
      [f("b")]: detail({
        seen: 1,
        misses: 0,
        everCorrect: true,
        firstTryCorrect: true,
        firstTryCount: 1,
        correct: 1,
      }),
    };

    const run = deriveRun(
      { mode: "drill", redrill: false, ts: 0, stats: mixed },
    );

    assert.deepEqual(run.needsWork, [f("a")]);
    assert.deepEqual(run.solid, [f("b")]);
  });
});

describe("summarize: nothing shown at all is not a 'perfect run'", () => {
  const EMPTY_HISTORY: HistoryFile = { sessions: [], facts: {} };

  it("does not fall through to a perfect-run headline over an empty board", () => {
    // Reachable now that a taught session can end (SessionHud's End session)
    // before its quiz phase ever starts — totalStats is completely empty,
    // not just clean. `missed.length` and `totalMisses` are both trivially 0
    // here, same as a genuinely perfect run; without an explicit empty guard
    // the cascade falls all the way to "Your first perfect run" over a
    // literal 0 shown · 0 correct · 0 incorrect · 0 not answered line.
    const run = deriveRun({ mode: "drill", redrill: false, ts: 0, stats: {} });
    const summary = summarize(run, {}, EMPTY_HISTORY, []);
    assert.notEqual(summary.headline, "Perfect run");
    assert.equal(summary.headline, "Nothing quizzed yet");
  });
});

describe("not-answered facts are neither scored nor solid", () => {
  const EMPTY_HISTORY: HistoryFile = { sessions: [], facts: {} };

  function unresolved(): Partial<FactSessionDetail> {
    return {
      seen: 0,
      misses: 0,
      everCorrect: false,
      firstTryCorrect: null,
      firstTryCount: 0,
      correct: 0,
    };
  }

  // Her exact reported scenario: 5 facts in the round — よ missed (said ぴ),
  // ひゆ and じゃ landed clean, あ and みゃ were put on screen and the round
  // ended before either was answered (seen: 0 — the zero-value key
  // statForShowing writes the instant a card is displayed; see
  // src/lib/drill-stats.ts).
  const stats: SessionStats = {
    [f("yo")]: detail({
      seen: 1,
      misses: 1,
      everCorrect: false,
      firstTryCorrect: false,
      firstTryCount: 0,
      correct: 0,
    }),
    [f("hyu")]: detail(),
    [f("sha")]: detail(),
    [f("a")]: detail(unresolved()),
    [f("mya")]: detail(unresolved()),
  };

  it("splits into shown / correct / incorrect / not-answered, matching the board", () => {
    const run = deriveRun({ mode: "drill", redrill: false, ts: 0, stats });

    assert.equal(run.facts.length, 5, "shown");
    assert.equal(run.correctFacts, 2, "correct");
    assert.deepEqual(run.missed, [f("yo")], "incorrect");
    assert.deepEqual(new Set(run.notAnswered), new Set([f("a"), f("mya")]));

    // Exhaustive and disjoint: every shown fact lands in exactly one of
    // correct / missed / notAnswered.
    assert.equal(
      run.correctFacts + run.missed.length + run.notAnswered.length,
      run.facts.length,
    );
  });

  it("keeps not-answered facts out of Solid — a card nothing happened to is not solid", () => {
    const run = deriveRun({ mode: "drill", redrill: false, ts: 0, stats });
    assert.deepEqual(new Set(run.solid), new Set([f("hyu"), f("sha")]));
    assert.ok(!run.solid.includes(f("a")));
    assert.ok(!run.solid.includes(f("mya")));
  });

  it("prints her exact breakdown line instead of a bare score fraction", () => {
    const run = deriveRun({ mode: "drill", redrill: false, ts: 0, stats });
    const summary = summarize(run, stats, EMPTY_HISTORY, []);
    const line = summary.counts.map((b) => b.t).join("");
    assert.equal(line, "5 shown · 2 correct · 1 incorrect · 2 not answered");
    // And the headline still names only the genuine miss — needsWork, not
    // the contaminated old `missed` list, decides the count.
    assert.equal(summary.headline, "1 thing needs another pass");
  });

  it("does not let a not-answered fact gate the run into 'misses' by itself", () => {
    // All correct, two never answered, nothing actually missed. The old
    // `isMissed` read `correct === 0` alone, which called an unresolved fact
    // "missed" too and could headline a clean run "0 things need another
    // pass".
    const allCorrectOrUnanswered: SessionStats = {
      [f("hyu")]: detail(),
      [f("sha")]: detail(),
      [f("a")]: detail(unresolved()),
    };
    const run = deriveRun({
      mode: "drill",
      redrill: false,
      ts: 0,
      stats: allCorrectOrUnanswered,
    });
    assert.deepEqual(run.missed, []);
    assert.deepEqual(run.needsWork, []);
  });
});

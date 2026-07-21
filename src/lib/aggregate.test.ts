// The fold, and the one thing about it that must not have changed.
//
// `firstTry` used to mean two things at once — the scheduler's hit AND the
// strict accuracy numerator — and splitting them touched the only line that
// feeds src/lib/scoring.ts. So most of this file is one claim, made three ways:
// SCHEDULING IS BIT-IDENTICAL. Counts are allowed to change (that is the fix);
// stability and lastTested are not, for any record, old format or new.

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { emptyAggregate, foldSession, foldSessions } from "@/lib/aggregate";
import { review } from "@/lib/scoring";
import type {
  FactAggregate,
  FactId,
  QuizSessionRecord,
  SessionFactCounts,
} from "@/types";

// ---------- the two writers, as they were and as they are ----------
//
// quiz-session.writeRecord lives in a .tsx and the runner has no JSX transform,
// so the write RULE is restated here — one line each, which is all it is. If
// writeRecord ever stops matching these, this file is where the lie shows up.

/** What one fact did in one run: the inputs both writers read. */
type Run = { seen: number; firstTryCount: number; firstTryCorrect: boolean };

/** BEFORE: the numerator was the flag, and the scheduler read it. */
function writeOld(r: Run): SessionFactCounts {
  return {
    seen: r.seen,
    missed: 0,
    slow: 0,
    firstTry: r.firstTryCorrect ? 1 : 0,
    correct: r.seen,
  };
}

/** AFTER: the numerator counts showings, the verdict rides its own field. */
function writeNew(r: Run): SessionFactCounts {
  return {
    seen: r.seen,
    missed: 0,
    slow: 0,
    firstTry: r.firstTryCount,
    correct: r.seen,
    firstTryHit: r.firstTryCorrect,
  };
}

/** BEFORE: foldSession as main wrote it — the hit derived from the numerator. */
function foldOld(agg: FactAggregate, s: SessionFactCounts, ts: number): void {
  agg.seen += s.seen;
  agg.missed += s.missed;
  agg.slow += s.slow;
  agg.firstTry += s.firstTry;
  agg.correct += s.correct;
  if (!s.seen) return;
  const next = review(agg, (s.firstTry ?? 0) > 0, ts);
  agg.stability = next.stability;
  agg.lastTested = next.lastTested;
}

const stateOf = (a: FactAggregate) => ({
  stability: a.stability,
  lastTested: a.lastTested,
});

// ---------- a corpus worth replaying ----------
//
// Every combination that can distinguish the two readings, not a happy path:
// the single showing, the repeat nailed every time (the case the accuracy fix
// is FOR), and the two orders of a mixed repeat — nailed-then-fumbled and
// fumbled-then-nailed. That last one is the whole reason the hit is not
// `firstTry > 0`: the count is positive and the verdict is false.
const DAY = 86_400_000;
const T0 = 1_700_000_000_000;

const CORPUS: readonly Run[][] = [
  // one showing, landed cold
  [{ seen: 1, firstTryCount: 1, firstTryCorrect: true }],
  // one showing, fumbled
  [{ seen: 1, firstTryCount: 0, firstTryCorrect: false }],
  // the perfect repeater: shown four times, nailed four times
  [{ seen: 4, firstTryCount: 4, firstTryCorrect: true }],
  // requeued after a miss, then nailed — count 1, verdict FALSE
  [{ seen: 3, firstTryCount: 1, firstTryCorrect: false }],
  // nailed first, fumbled a later showing — count 1, verdict TRUE
  [{ seen: 3, firstTryCount: 1, firstTryCorrect: true }],
  // in the record but never asked: not a test occasion
  [{ seen: 0, firstTryCount: 0, firstTryCorrect: false }],
  // a history: several sessions, mixed, over days
  [
    { seen: 2, firstTryCount: 2, firstTryCorrect: true },
    { seen: 3, firstTryCount: 1, firstTryCorrect: false },
    { seen: 1, firstTryCount: 1, firstTryCorrect: true },
    { seen: 5, firstTryCount: 5, firstTryCorrect: true },
    { seen: 2, firstTryCount: 0, firstTryCorrect: false },
  ],
];

/** Replay one fact's history through a chosen writer and fold. */
function replay(
  runs: readonly Run[],
  write: (r: Run) => SessionFactCounts,
  fold: (a: FactAggregate, s: SessionFactCounts, ts: number) => void,
): FactAggregate {
  const agg = emptyAggregate();
  runs.forEach((r, i) => fold(agg, write(r), T0 + i * DAY));
  return agg;
}

describe("scheduling is unchanged by the firstTry split", () => {
  it("new records schedule exactly as the old field did", () => {
    for (const runs of CORPUS) {
      const before = replay(runs, writeOld, foldOld);
      const after = replay(runs, writeNew, foldSession);
      assert.deepEqual(
        stateOf(after),
        stateOf(before),
        `stability/lastTested drifted for ${JSON.stringify(runs)}`,
      );
    }
  });

  it("OLD records replay to byte-identical scheduling state", () => {
    // The migration case: history.json on a real install, `firstTry` still 0/1
    // and no `firstTryHit` anywhere. Absent must derive to the old answer.
    for (const runs of CORPUS) {
      const before = replay(runs, writeOld, foldOld);
      const after = replay(runs, writeOld, foldSession);
      assert.deepEqual(stateOf(after), stateOf(before));
      // and nothing else about an old record moved either: an old file read by
      // new code is the same file, counts included.
      assert.deepEqual(after, before);
    }
  });

  it("the hit is the verdict, NOT the count being positive", () => {
    // Fumble the first showing, nail the requeue. The count is 1. If the hit
    // were derived from it the model would hear a pass, and the fact would be
    // scheduled further out than a fact you did not actually know.
    const fumbledThenNailed: Run = {
      seen: 3,
      firstTryCount: 1,
      firstTryCorrect: false,
    };
    const nailed: Run = { seen: 3, firstTryCount: 1, firstTryCorrect: true };

    const missed = replay([fumbledThenNailed], writeNew, foldSession);
    const hit = replay([nailed], writeNew, foldSession);

    assert.equal(missed.firstTry, hit.firstTry, "same count, by construction");
    assert.ok(
      missed.stability < hit.stability,
      "a fact only landed on the requeue must not be scheduled like one landed cold",
    );

    // The leniency this guards against, stated as arithmetic: had the hit been
    // derived, these two would be indistinguishable.
    const derived = replay([fumbledThenNailed], writeNew, foldOld);
    assert.equal(derived.stability, hit.stability);
    assert.notEqual(derived.stability, missed.stability);
  });

  it("a fact that was never asked still does not move the clock", () => {
    const agg = emptyAggregate();
    foldSession(agg, { seen: 0, firstTry: 0, firstTryHit: true }, T0);
    assert.equal(agg.lastTested, 0, "no showings is not a test occasion");
  });
});

describe("the durable accuracy numerator counts showings", () => {
  it("a perfect learner reads 100% however often a fact repeats", () => {
    for (const seen of [1, 2, 3, 7]) {
      const agg = replay(
        [{ seen, firstTryCount: seen, firstTryCorrect: true }],
        writeNew,
        foldSession,
      );
      assert.equal(
        agg.firstTry / agg.seen,
        1,
        `${seen} perfect showings must read 100%, not 1/${seen}`,
      );
    }
  });

  it("pools across sessions in one unit", () => {
    const agg = replay(
      [
        { seen: 2, firstTryCount: 2, firstTryCorrect: true },
        { seen: 3, firstTryCount: 3, firstTryCorrect: true },
      ],
      writeNew,
      foldSession,
    );
    assert.equal(agg.seen, 5);
    assert.equal(agg.firstTry, 5);
  });
});

describe("foldSessions", () => {
  const F = "a" as FactId;

  const rec = (ts: number, s: SessionFactCounts): QuizSessionRecord => ({
    ts,
    mode: "drill",
    redrill: false,
    total: 1,
    forgivingPct: 100,
    strictPct: 100,
    facts: { [F]: s },
  });

  it("sorts by timestamp, so a shuffled replay is the same replay", () => {
    const runs = CORPUS[CORPUS.length - 1];
    const records = runs.map((r, i) => rec(T0 + i * DAY, writeNew(r)));
    const ordered = foldSessions(records);
    const shuffled = foldSessions([...records].reverse());
    assert.deepEqual(shuffled[F], ordered[F]);
  });

  it("an old file and a new file of the same run schedule alike", () => {
    const runs = CORPUS[CORPUS.length - 1];
    const old = foldSessions(runs.map((r, i) => rec(T0 + i * DAY, writeOld(r))));
    const now = foldSessions(runs.map((r, i) => rec(T0 + i * DAY, writeNew(r))));
    assert.deepEqual(stateOf(now[F]), stateOf(old[F]));
    // Counts DID change, and that is the fix: the old file undercounted.
    assert.ok(now[F].firstTry > old[F].firstTry);
  });
});

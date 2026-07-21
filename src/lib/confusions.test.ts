// Run: node --test src/lib/confusions.test.ts
//
// Uses node:test + native TypeScript stripping (Node 24). No test framework,
// no new dependencies. confusions.ts imports only types, which stripping
// erases, so it loads here as the pure module it claims to be.
//
// WHY THIS FILE EXISTS
// ====================
// The five-state confusion lifecycle is the thing in this codebase most able to
// die silently. Every state transition is a fold over history, nothing throws
// when the fold is wrong, and every screen keeps rendering — a pair that never
// graduates looks exactly like a pair you never beat.
//
// The specific trap: pairs are keyed by ENTRY, a run's detail by FACT. The
// denominator rule asks "did this run show either of the pair's entries", and
// when that question used to be asked of a character-keyed map with a character
// key, it worked by coincidence. Ask it of a fact-keyed map and it answers
// `false` forever: no run qualifies, no pair accrues a clean run, nothing
// graduates, and the whole lifecycle quietly stops existing.
//
// So the tests below are deliberately built on a MULTI-FACT entry — 生, with a
// reading per word — because that is the case a kana-shaped test cannot see.
// With one fact per entry the two key spaces are 1:1 and a broken conversion
// still passes.

import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  activeWeaknessPairs,
  analyzeRun,
  pairKey,
  pairRecords,
} from "./confusions.ts";
import type {
  EntryId,
  FactId,
  FactSessionDetail,
  HistoryFile,
  QuizSessionRecord,
  SessionStats,
} from "../types/index.ts";

// ---------- a synthetic subject ----------
//
// Deliberately NOT kana and NOT the real registry: confusions.ts takes its
// `entryOf` as an argument precisely so it never has to know what a subject is.
// 生 has two readings here, keyed by the word they are read in — the shape the
// whole entry/fact split exists for.

const SEI: FactId = "kanji:生/reading@学生" as FactId;
const SHOU: FactId = "kanji:生/reading@先生" as FactId;
const SEN: FactId = "kanji:先/reading@先生" as FactId;
const A: FactId = "kana:あ/reading" as FactId;

const NAMA: EntryId = "kanji:生" as EntryId;
const SAKI: EntryId = "kanji:先" as EntryId;
const AE: EntryId = "kana:あ" as EntryId;

const OWNER: Record<FactId, EntryId> = {
  [SEI]: NAMA,
  [SHOU]: NAMA,
  [SEN]: SAKI,
  [A]: AE,
};

const entryOf = (f: FactId): EntryId => OWNER[f];

const PAIR = pairKey(NAMA, SAKI);

// ---------- builders ----------

function stat(over: Partial<FactSessionDetail> = {}): FactSessionDetail {
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

/** A run that showed `facts` and mixed nothing up. */
function clean(...facts: FactId[]): SessionStats {
  const s: SessionStats = {};
  for (const f of facts) s[f] = stat();
  return s;
}

/** A run that showed `shown` and answered it as the entry `said`. */
function mixup(shown: FactId, said: EntryId, times = 1): SessionStats {
  return {
    [shown]: stat({
      misses: times,
      firstTryCorrect: false,
      confused: { [said]: times },
    }),
  };
}

function history(...details: SessionStats[]): HistoryFile {
  const sessions: QuizSessionRecord[] = details.map((detail, i) => ({
    ts: i + 1,
    mode: "drill",
    redrill: false,
    total: Object.keys(detail).length,
    forgivingPct: 100,
    strictPct: 100,
    facts: {},
    detail,
  }));
  return { sessions, facts: {} };
}

const GRAD = 3;

function recordFor(h: HistoryFile) {
  const rec = pairRecords(h, GRAD, { entryOf }).get(PAIR);
  assert.ok(rec, "the pair should have a record");
  return rec;
}

// ---------- the denominator rule ----------

describe("the denominator rule", () => {
  test("a run that showed neither entry does not count as clean", () => {
    // 生↔先 mixed up once, then ten runs of nothing but あ. Without the rule,
    // a week of unrelated practice would graduate a pair that never had a
    // chance to appear.
    const h = history(
      mixup(SEI, SAKI),
      ...Array.from({ length: 10 }, () => clean(A)),
    );
    const rec = recordFor(h);
    assert.equal(rec.cleanStreak, 0, "unrelated runs must not build a streak");
    assert.equal(rec.tracked, true, "the pair must still be an open weakness");
    assert.equal(rec.qualifyingRuns, 1);
  });

  test("a run showing a DIFFERENT fact of the same entry still qualifies", () => {
    // THE REGRESSION. The mix-up is recorded against 生's 学生-reading; the
    // clean runs only ever show its 先生-reading. Same ENTRY, different FACT.
    //
    // If the denominator rule is asked its question in fact space — the shape
    // the old `a in detail` had — none of these runs match, the streak never
    // advances, and the pair never graduates. Nothing throws; it just stops.
    const h = history(mixup(SEI, SAKI), clean(SHOU), clean(SHOU), clean(SHOU));
    const rec = recordFor(h);
    assert.equal(rec.qualifyingRuns, 4, "all four runs showed entry 生");
    assert.equal(rec.cleanStreak, 3);
  });
});

// ---------- graduation ----------

describe("the lifecycle graduates", () => {
  test("tracked stays open below the threshold", () => {
    const h = history(mixup(SEI, SAKI), clean(SEI), clean(SEI));
    const rec = recordFor(h);
    assert.equal(rec.cleanStreak, 2);
    assert.equal(rec.tracked, true, "2 of 3 clean runs is not graduation");
  });

  test("the clean streak hitting graduateRuns retires the record", () => {
    const h = history(mixup(SEI, SAKI), clean(SEI), clean(SEI), clean(SEI));
    const rec = recordFor(h);
    assert.equal(rec.cleanStreak, 3);
    assert.equal(rec.tracked, false, "graduated: the record is spent");
    assert.equal(rec.everMixedUp, true, "but it did happen, and that is kept");
  });

  test("a graduated pair stops counting against you", () => {
    const open = history(mixup(SEI, SAKI), clean(SEI), clean(SEI));
    assert.equal(
      activeWeaknessPairs(open, GRAD, entryOf).length,
      1,
      "still an open weakness before graduation",
    );

    const done = history(mixup(SEI, SAKI), clean(SEI), clean(SEI), clean(SEI));
    assert.equal(
      activeWeaknessPairs(done, GRAD, entryOf).length,
      0,
      "cleared means cleared — it reports nothing, anywhere",
    );
  });

  test("a fresh mix-up after graduation opens a clean sheet", () => {
    const h = history(
      mixup(SEI, SAKI, 9),
      clean(SEI),
      clean(SEI),
      clean(SEI),
      mixup(SEI, SAKI, 1),
    );
    const rec = recordFor(h);
    assert.equal(rec.tracked, true, "a new record is open");
    assert.equal(rec.runsMixedUp, 1, "the old rap sheet is spent, not carried");
    assert.equal(rec.total, 1, "the 9 old misses do not count against it");
  });
});

// ---------- what a run reports ----------

describe("analyzeRun reports the run against history", () => {
  test("a first mix-up is new, not a weakness", () => {
    const run = mixup(SEI, SAKI);
    const { patterns } = analyzeRun(run, history(), { graduateRuns: GRAD, entryOf });
    assert.equal(patterns.length, 1);
    assert.equal(patterns[0].state, "new");
  });

  test("mixing it up again with an open record is a weakness", () => {
    const prior = history(mixup(SEI, SAKI));
    const run = mixup(SEI, SAKI);
    const { patterns } = analyzeRun(run, prior, { graduateRuns: GRAD, entryOf });
    assert.equal(patterns[0].state, "weakness");
  });

  test("the graduation run reports cleared exactly once, then nothing", () => {
    // Two clean qualifying runs behind us; this one lands on the threshold.
    const prior = history(mixup(SEI, SAKI), clean(SEI), clean(SEI));
    const cleared = analyzeRun(clean(SEI), prior, {
      graduateRuns: GRAD,
      entryOf,
    });
    assert.equal(cleared.progress.length, 1, "the graduation run must report");
    assert.equal(cleared.progress[0].state, "cleared");

    // One run later the pair is retired, and retired says nothing at all.
    const after = history(mixup(SEI, SAKI), clean(SEI), clean(SEI), clean(SEI));
    const retired = analyzeRun(clean(SEI), after, {
      graduateRuns: GRAD,
      entryOf,
    });
    assert.equal(retired.progress.length, 0, "retired reports nothing, anywhere");
    assert.equal(retired.patterns.length, 0);
  });

  test("an improving run is reported, and counts down to graduation", () => {
    const prior = history(mixup(SEI, SAKI), clean(SEI));
    const { progress } = analyzeRun(clean(SEI), prior, {
      graduateRuns: GRAD,
      entryOf,
    });
    assert.equal(progress.length, 1);
    assert.equal(progress[0].state, "improving");
    assert.equal(progress[0].record.cleanStreak, 2, "2 down, 1 to clear it");
  });

  test("a run must not appear in its own history", () => {
    // The session is POSTed the instant it finishes, so by the time Results
    // reads history the run may already be in it. Judging a run by a history
    // containing that run would count its mix-up twice.
    const run = mixup(SEI, SAKI);
    const withItself = history(run); // ts 1
    const { patterns } = analyzeRun(run, withItself, {
      graduateRuns: GRAD,
      entryOf,
      excludeTs: 1,
    });
    assert.equal(patterns[0].state, "new", "excluded — so this is its first");
    assert.equal(patterns[0].record.total, 1, "counted once, not twice");
  });
});

// ---------- direction ----------

describe("direction is read in entry space", () => {
  test("a lopsided pair names the entry you don't recognise", () => {
    // 生 shown and answered as 先, four times, across BOTH of 生's readings —
    // one entry, two facts, one confusion.
    const runs = [
      mixup(SEI, SAKI, 2),
      mixup(SHOU, SAKI, 2),
      mixup(SEI, SAKI, 1),
    ];
    const { patterns } = analyzeRun(runs[2], history(runs[0], runs[1]), {
      graduateRuns: GRAD,
      entryOf,
    });
    const row = patterns[0];
    assert.equal(row.record.total, 5, "all five mix-ups fold into one pair");
    assert.equal(row.direction.kind, "one-way");
    if (row.direction.kind === "one-way") {
      assert.equal(row.direction.shown, NAMA, "生 is the one to drill");
      assert.equal(row.direction.readAs, SAKI);
    }
  });
});

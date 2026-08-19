// Run: node --test --experimental-strip-types \
//        --import ./src/lib/conjugate/test-hooks.mjs src/lib/mix-up-counts.test.ts
//
// SAK-22 — THE PRACTICE CHIP AND THE PROGRESS COUNT
// ==================================================
// The Practice page's "Mix-ups" status chip (practice-selector.tsx, via
// selection.ts's `mixedUpEntries` → resolve) and the Progress page's "Things
// you mix up" section (stats/mix-ups.tsx) used to disagree in the same
// session — 5 on one, 3 on the other. Two things were wrong at once:
//
//   1. mix-ups.tsx counted every pair with `everMixedUp`, which includes
//      "sorted" (graduated) pairs. `activeWeaknessPairs` already excludes
//      those everywhere else it's read (Practice's chip, the Library's
//      mix-up filter) — mix-ups.tsx just never called it, and derived its
//      own filter instead. Fixed: its header count now reads
//      `activeWeaknessPairs`, the same function selection.ts's
//      `mixedUpEntries` reads. Its ROW LIST is unchanged — sorted pairs still
//      show, dimmed, per this page's own "Statistics remembers" design — only
//      the header count stops crediting them.
//
//   2. Even fixed, the two numbers do not become the SAME number, and that is
//      not a bug: Practice counts drillable FACTS (an entry can own many —
//      see facts.ts's `factsOf`, "1 for a kana, ~11 for a kanji"), Progress
//      counts PAIRS (always 2 entries). Forcing either side to adopt the
//      other's unit would break a stronger invariant elsewhere: Practice's
//      chip number IS what Start drills (practice-selector.tsx's own header
//      comment), and Progress's header number IS `rows.length`'s pair table.
//      So the fix is a shared SOURCE (activeWeaknessPairs), not a shared
//      NUMBER, and the Progress label spells out "pairs" so the two are never
//      read as the same measurement again.
//
// These tests pin both halves against real kana/kanji data: that the two
// sites' "currently confuses" sets are now identical, and that the residual
// item/pair gap is the documented, deterministic facts-per-entry multiplier —
// not unexplained drift.

import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { activeWeaknessPairs, pairKey, pairRecords } from "./confusions.ts";
import { entryOf, factsOf } from "./facts.ts";
import { emptySelection, resolve } from "./selection.ts";
import type {
  EntryId,
  FactAggregate,
  FactId,
  FactSessionDetail,
  HistoryFile,
  QuizSessionRecord,
  SessionStats,
} from "../types/index.ts";

// ---------- fixtures ----------
//
// Real kana ids, not synthetic ones — kana is the exact 1-fact-per-entry case
// (facts.ts's `factsOf` doc comment: "1 for a kana"), so the item/pair
// relationship below is exact and assertable rather than approximate.

const A_FACT = "kana:あ/reading" as FactId;
const A_ENTRY = "kana:あ" as EntryId;
const I_FACT = "kana:い/reading" as FactId;
const I_ENTRY = "kana:い" as EntryId;
const U_FACT = "kana:う/reading" as FactId;
const U_ENTRY = "kana:う" as EntryId;
const E_FACT = "kana:え/reading" as FactId;
const E_ENTRY = "kana:え" as EntryId;

const GRAD = 3;

function stat(over: Partial<FactSessionDetail> = {}): FactSessionDetail {
  return {
    seen: 1,
    misses: 0,
    everCorrect: true,
    firstTryCorrect: true,
    firstTryCount: 1,
    correct: 1,
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

function seenFact(over: Partial<FactAggregate> = {}): FactAggregate {
  return {
    seen: 4,
    missed: 0,
    firstTry: 4,
    correct: 4,
    stability: 10,
    lastTested: 0,
    ...over,
  };
}

/** A history whose sessions are exactly `details`, with the four kana facts
 * this file uses marked "known" — resolve()'s pool starts from what you've
 * seen (see selection.ts's `knownFacts`), so a fact absent here would drop
 * out of Practice's count before mixup matching even runs, independent of
 * whatever this test is trying to isolate. */
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
  const facts: Record<FactId, FactAggregate> = {
    [A_FACT]: seenFact(),
    [I_FACT]: seenFact(),
    [U_FACT]: seenFact(),
    [E_FACT]: seenFact(),
  };
  return { sessions, facts, claims: {} };
}

/** Practice's "Mix-ups" chip count — resolve() with the mixup band selected,
 * exactly as practice-selector.tsx's `statusCounts` calls it. */
function practiceMixupFacts(h: HistoryFile): FactId[] {
  return resolve({ ...emptySelection(), states: ["mixup"] }, h, [], 0, {
    graduateRuns: GRAD,
  });
}

/** Progress's fixed header count — see stats/mix-ups.tsx's `activeCount`. */
function progressHeaderCount(h: HistoryFile): number {
  return activeWeaknessPairs(h, GRAD, entryOf).length;
}

describe("Practice's chip and Progress's header now share one source", () => {
  test("no confusions — both sides read zero", () => {
    const h = history(clean(A_FACT), clean(I_FACT));
    assert.equal(progressHeaderCount(h), 0);
    assert.equal(practiceMixupFacts(h).length, 0);
  });

  test("two disjoint kana pairs: Progress's pairs and Practice's facts both trace to the same active set", () => {
    const h = history(mixup(A_FACT, I_ENTRY), mixup(U_FACT, E_ENTRY));

    const active = activeWeaknessPairs(h, GRAD, entryOf);
    assert.equal(active.length, 2, "Progress's header, post-fix: '2 pairs'");

    const activeEntries = new Set(active.flatMap((p) => [p.a, p.b]));
    assert.deepEqual(
      [...activeEntries].sort(),
      [A_ENTRY, E_ENTRY, I_ENTRY, U_ENTRY].sort(),
      "the exact entries both sites must agree the learner currently confuses",
    );

    const mixupFacts = practiceMixupFacts(h);
    // Kana is 1 fact per entry, and the two pairs share no entry, so
    // Practice's chip is deterministically 2x Progress's pair count here —
    // a documented relationship, not an unexplained mismatch.
    assert.equal(mixupFacts.length, 2 * active.length);
    assert.deepEqual(
      [...mixupFacts].sort(),
      [A_FACT, E_FACT, I_FACT, U_FACT].sort(),
      "exactly the facts of the entries activeWeaknessPairs named",
    );
  });

  test("a graduated pair drops out of BOTH counts, but stays in Progress's row list", () => {
    // Mixed up once, then three clean qualifying runs — cleanStreak hits GRAD
    // and the pair graduates ("sorted": confusions.ts's `step`).
    const h = history(
      mixup(A_FACT, I_ENTRY),
      clean(A_FACT),
      clean(A_FACT),
      clean(A_FACT),
    );

    assert.equal(
      progressHeaderCount(h),
      0,
      "graduated: Progress's fixed header count no longer credits it",
    );
    assert.equal(
      practiceMixupFacts(h).length,
      0,
      "Practice's chip already excluded it — it always read activeWeaknessPairs",
    );

    // The pair's ROW is a separate question from the header count: Progress's
    // table still lists a graduated pair, dimmed, as "sorted" — that is this
    // page's own documented reward for having beaten it. Before this fix,
    // mix-ups.tsx's header read straight off this same `everMixedUp` filter,
    // so it printed "1" here while Practice already printed "0": the bug.
    const key = pairKey(A_ENTRY, I_ENTRY);
    const rec = pairRecords(h, GRAD, { entryOf }).get(key);
    assert.equal(rec?.everMixedUp, true, "still shown, dimmed, in the table");
    assert.equal(rec?.tracked, false, "but excluded from the header count");
  });

  test("a kanji entry can own many more facts than a kana one — why the gap grows with real data", () => {
    // Real registry, not a fixture: 生 carries one meaning fact plus one
    // reading fact per word it's read in. One mixed-up kanji pair can already
    // move Practice's fact-count chip by more than several kana pairs would,
    // while it moves Progress's pair count by exactly one either way — the
    // multiplier the bug report's "5 vs 3" came from.
    assert.ok(
      factsOf("kanji:生" as EntryId).length > 4,
      "a single kanji entry, several facts — the documented pair/item gap",
    );
  });
});

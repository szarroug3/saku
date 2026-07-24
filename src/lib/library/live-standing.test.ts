// Run: node --import ./src/lib/conjugate/test-hooks.mjs --test \
//        src/lib/library/live-standing.test.ts
//
// WHAT THIS TEST IS FOR
// =====================
// The Library's standing used to read only COMMITTED history, so a card missed
// mid-drill stayed "not seen" / "solid" until End session. `foldLiveStats`
// composes committed `history.facts` with the in-progress run's outcomes at read
// time, so a miss shows the moment its card resolves. These pin the four things
// that fold has to get right, all through the REAL standing (standing.ts), the
// same word the Library prints:
//
//   a fresh in-progress miss reads SHAKY — not "not seen" (the reported bug),
//     and not "solid" (recency alone must not launder a miss into mastery);
//   a live miss pushes a solid fact to shaky, live, before any commit;
//   COMMITTING that same run does not move the standing — the live number and
//     the durable one are the same measurement, folded the same way;
//   a DISCARDED run (empty live stats) leaves the committed aggregate untouched,
//     by reference, and never mutates it — nothing to resurrect.

import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { emptyAggregate, foldSession } from "@/lib/aggregate";
import { foldLiveStats } from "@/lib/library/live-standing";
import { standingOf } from "@/lib/library/standing";
import { projectSessionFacts } from "@/lib/session-record";
import type {
  AccuracyMetric,
  FactAggregate,
  FactId,
  FactSessionDetail,
  SessionStats,
} from "@/types";

const METRIC: AccuracyMetric = "firstTry";
const NOW = Date.UTC(2026, 6, 1);
const fid = (s: string) => s as unknown as FactId;

const NANI = fid("kanji:何/meaning");
const OTHER = fid("kanji:生/meaning");

/** One resolved showing. Defaults to a clean first-try hit; override for a miss. */
function stat(p: Partial<FactSessionDetail> = {}): FactSessionDetail {
  return {
    seen: 1,
    misses: 0,
    everCorrect: true,
    firstTryCorrect: true,
    firstTryCount: 1,
    correct: 1,
    slow: 0,
    confused: {},
    ...p,
  };
}

/** A single first-try MISS — seen once, nailed nothing. */
const MISS: FactSessionDetail = stat({
  misses: 1,
  everCorrect: false,
  firstTryCorrect: false,
  firstTryCount: 0,
  correct: 0,
});

/** Fold a run's stats onto a fresh aggregate the way history.saveSession does —
 * projection + one review, at `ts`. This is what a COMMIT lands. */
function commit(
  base: Record<FactId, FactAggregate>,
  live: SessionStats,
  ts: number,
): Record<FactId, FactAggregate> {
  const out: Record<FactId, FactAggregate> = {};
  for (const [k, v] of Object.entries(base)) out[k as FactId] = { ...v };
  const facts = projectSessionFacts(live);
  for (const [key, counts] of Object.entries(facts)) {
    const f = key as FactId;
    foldSession((out[f] ??= emptyAggregate()), counts, ts);
  }
  return out;
}

describe("foldLiveStats — the Library reflects a miss the moment it lands", () => {
  test("the reported bug: a fresh miss on a not-seen fact reads shaky, not not-seen", () => {
    // Before: 何 has never been asked — the Library says "not seen".
    assert.equal(
      standingOf(undefined, undefined, METRIC, NOW).standing,
      "not-seen",
    );

    // Mid-drill: one miss, still uncommitted, living only in the run's stats.
    const live: SessionStats = { [NANI]: MISS };
    const view = foldLiveStats({}, live, NOW);

    const s = standingOf(view[NANI], undefined, METRIC, NOW);
    assert.notEqual(s.standing, "not-seen", "the miss must show at once");
    assert.notEqual(
      s.standing,
      "solid",
      "recency alone must not read a fresh miss as solid",
    );
    assert.equal(s.standing, "shaky", "0/1 first-try is shaky");
    assert.equal(s.seen, 1);
  });

  test("a live miss pushes a solid fact to shaky before any commit", () => {
    // 何 committed: one clean first-try showing a moment ago → solid.
    const base = commit({}, { [NANI]: stat() }, NOW - 1000);
    assert.equal(
      standingOf(base[NANI], undefined, METRIC, NOW).standing,
      "solid",
    );

    // Now miss it mid-drill. 1/2 = 50% first-try → shaky, live.
    const view = foldLiveStats(base, { [NANI]: MISS }, NOW);
    assert.equal(
      standingOf(view[NANI], undefined, METRIC, NOW).standing,
      "shaky",
      "the uncommitted miss drops it out of solid immediately",
    );
    // Untouched facts keep their committed standing.
    assert.deepEqual(view[OTHER], base[OTHER]);
  });

  test("committing the same run does not move the standing", () => {
    const base = commit({}, { [NANI]: stat() }, NOW - 1000);
    const live: SessionStats = { [NANI]: MISS };

    const liveView = foldLiveStats(base, live, NOW);
    const committed = commit(base, live, NOW);

    // The live word and the durable word are the same measurement: same
    // projection, same fold. When the round finally banks, nothing on the page
    // changes — which is the whole promise of folding at read time.
    assert.equal(
      standingOf(liveView[NANI], undefined, METRIC, NOW).standing,
      standingOf(committed[NANI], undefined, METRIC, NOW).standing,
    );
    // After commit the run's live stats are empty; the view is just committed.
    const afterCommit = foldLiveStats(committed, {}, NOW);
    assert.equal(
      standingOf(afterCommit[NANI], undefined, METRIC, NOW).standing,
      standingOf(liveView[NANI], undefined, METRIC, NOW).standing,
    );
  });

  test("a discarded run leaves committed history untouched, by reference", () => {
    const base = commit({}, { [NANI]: stat() }, NOW - 1000);

    // Discard clears the session, so the provider hands empty live stats. The
    // committed aggregate must come back unchanged — same object, not a copy —
    // so a rolled-back run has nothing left to resurrect (pairs with #26).
    const view = foldLiveStats(base, {}, NOW);
    assert.equal(view, base, "empty live returns the committed map by reference");
  });

  test("does not mutate the committed aggregate it folds onto", () => {
    const base = commit({}, { [NANI]: stat() }, NOW - 1000);
    const before = { ...base[NANI] };

    foldLiveStats(base, { [NANI]: MISS }, NOW);

    assert.deepEqual(base[NANI], before, "base entry must be cloned before fold");
  });

  test("no double count: live stats fold onto committed rounds exactly once", () => {
    // 何 already has a committed round (2 first-try showings). A second, live
    // round of 2 more must read as 4 seen / 4 first-try — added once, not twice.
    const base = commit({}, { [NANI]: stat({ seen: 2, firstTryCount: 2, correct: 2 }) }, NOW - 1000);
    const live: SessionStats = { [NANI]: stat({ seen: 2, firstTryCount: 2, correct: 2 }) };

    const view = foldLiveStats(base, live, NOW);
    assert.equal(view[NANI].seen, 4);
    assert.equal(view[NANI].firstTry, 4);
    assert.equal(view[NANI].correct, 4);
  });
});

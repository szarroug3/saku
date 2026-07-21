// The record projection, and the one property the per-round commit turns on:
// A ROUND COMMITTED AS IT CLOSES MUST NOT ALSO BE COUNTED AT THE END.
//
// This is the main correctness risk in moving the commit point. The old code
// wrote one record per session, from `totalStats`, at the very end. The new code
// writes one per round, from `roundStats`, as each closes — and writes nothing
// at the end. If both fired, or if the round records overlapped, every count in
// the session would be inflated in the one file that is meant to be the durable
// copy, permanently and invisibly.
//
// So the tests below replay a whole session BOTH ways and compare what lands in
// the aggregate. They also pin the `firstTry` / `firstTryHit` split, which is the
// other thing a new writer of records is in a position to get wrong (see
// aggregate.ts: one is a COUNT of first-try showings, the other is the
// scheduler's per-occasion verdict, and writing a flag where the count goes is
// exactly the bug the aggregate split had just fixed).

import assert from "node:assert/strict";
import { test } from "node:test";

import { emptyAggregate, foldSession } from "@/lib/aggregate";
import { mergeStats } from "@/lib/session";
import { buildSessionRecord } from "@/lib/session-record";
import type {
  FactAggregate,
  FactId,
  FactSessionDetail,
  QuizSessionRecord,
  SessionStats,
} from "@/types";

const fid = (s: string) => s as unknown as FactId;

const A = fid("kana:あ/reading");
const I = fid("kana:い/reading");
const U = fid("kana:う/reading");

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

/** What ONE drill leg produced. A round is one of these, or several merged. */
const LEG_1: SessionStats = {
  [A]: stat(),
  [I]: stat({ misses: 2, firstTryCorrect: false, firstTryCount: 0, slow: 1 }),
  [U]: stat({ misses: 1, firstTryCorrect: false, firstTryCount: 0, everCorrect: false, correct: 0 }),
};

/** "Retry the misses", back into the SAME round. */
const RETRY_LEG: SessionStats = {
  [I]: stat(),
  [U]: stat({ misses: 1, firstTryCorrect: false, firstTryCount: 0 }),
};

/** Round 2, the same whole set again. */
const LEG_2: SessionStats = {
  [A]: stat({ seen: 2, correct: 2, firstTryCount: 2 }),
  [I]: stat(),
  [U]: stat({ misses: 1, firstTryCorrect: false, firstTryCount: 0 }),
};

const ROUND_1 = mergeStats(mergeStats({}, LEG_1), RETRY_LEG);
const ROUND_2 = mergeStats({}, LEG_2);
/** What `finishSession` used to write, in one record, at the end. */
const TOTAL_STATS = mergeStats(ROUND_1, ROUND_2);

const OPTS = { mode: "drill" as const, redrill: false };

/** Fold a set of records the way history.saveSession does, in ts order. */
function foldAll(records: QuizSessionRecord[]): Record<string, FactAggregate> {
  const facts: Record<string, FactAggregate> = {};
  for (const r of [...records].sort((a, b) => a.ts - b.ts)) {
    for (const [key, s] of Object.entries(r.facts)) {
      foldSession((facts[key] ??= emptyAggregate()), s, r.ts);
    }
  }
  return facts;
}

/** Counts only — `stability` and `lastTested` are beliefs and are NOT expected
 * to match across the two shapes. See the note in the test that says so. */
function counts(agg: Record<string, FactAggregate>) {
  const out: Record<string, unknown> = {};
  for (const [k, a] of Object.entries(agg)) {
    out[k] = {
      seen: a.seen,
      missed: a.missed,
      slow: a.slow,
      firstTry: a.firstTry,
      correct: a.correct,
    };
  }
  return out;
}

test("a session committed round-by-round counts exactly once", () => {
  // THE TRAP. Round 1 is played, its misses are retried back into the same
  // round, the round is COMMITTED as it closes, round 2 is then played and
  // committed — and the session finishes, writing nothing more.
  const perRound = foldAll([
    buildSessionRecord(ROUND_1, { ...OPTS, ts: 1_000, rounds: 1 })!,
    buildSessionRecord(ROUND_2, { ...OPTS, ts: 2_000, rounds: 1 })!,
  ]);

  // A single clean run of the very same work, written the old way: one record,
  // from totalStats, at the end.
  const oneShot = foldAll([
    buildSessionRecord(TOTAL_STATS, { ...OPTS, ts: 2_000 })!,
  ]);

  assert.deepEqual(
    counts(perRound),
    counts(oneShot),
    "committing per round must not inflate a single durable count",
  );
});

test("committing a round and THEN the whole session would double it — proof the check is real", () => {
  // The negative control. Without this, the test above would pass just as
  // happily against a projection that produced zeroes.
  const doubled = foldAll([
    buildSessionRecord(ROUND_1, { ...OPTS, ts: 1_000 })!,
    buildSessionRecord(ROUND_2, { ...OPTS, ts: 2_000 })!,
    // The write finishSession no longer makes.
    buildSessionRecord(TOTAL_STATS, { ...OPTS, ts: 3_000 })!,
  ]);
  const correct = foldAll([
    buildSessionRecord(ROUND_1, { ...OPTS, ts: 1_000 })!,
    buildSessionRecord(ROUND_2, { ...OPTS, ts: 2_000 })!,
  ]);

  assert.equal(correct[A].seen, 3, "あ was shown three times across the session");
  assert.equal(doubled[A].seen, 6, "…and six if the session were also written");
  assert.notDeepEqual(counts(doubled), counts(correct));
});

test("the rounds partition the session — nothing is left out either", () => {
  // The other half of "counted exactly once": counted at LEAST once. A commit
  // point that silently dropped a retry leg would pass the equality test above
  // only if the one-shot dropped it too, so the totals are also stated outright.
  const perRound = foldAll([
    buildSessionRecord(ROUND_1, { ...OPTS, ts: 1_000 })!,
    buildSessionRecord(ROUND_2, { ...OPTS, ts: 2_000 })!,
  ]);
  // あ: once in round 1, twice in round 2.
  assert.equal(perRound[A].seen, 3);
  // い: leg 1 + retry leg + round 2.
  assert.equal(perRound[I].seen, 3);
  assert.equal(perRound[I].missed, 2, "both of leg 1's misses survive");
  // う: leg 1 + retry + round 2, missed once in each.
  assert.equal(perRound[U].seen, 3);
  assert.equal(perRound[U].missed, 3);
  assert.equal(perRound[U].correct, 2, "leg 1's unanswered showing is not a pass");
});

test("`firstTry` is a COUNT of showings and `firstTryHit` is the round's verdict", () => {
  const r = buildSessionRecord(ROUND_2, { ...OPTS, ts: 2_000 })!;

  // あ was nailed cold on both of round 2's showings: the count is 2, not the
  // flag's 1. Writing a flag here is the regression the aggregate split fixed.
  assert.equal(r.facts[A].firstTry, 2);
  assert.equal(r.facts[A].firstTryHit, true);
  // う was missed on its first showing of the round. The count is 0 and the
  // verdict is false, and the model must hear the verdict.
  assert.equal(r.facts[U].firstTry, 0);
  assert.equal(r.facts[U].firstTryHit, false);

  // Round 1: い fluffed the first showing and nailed the requeue. Count 1,
  // verdict FALSE — the case `firstTry > 0` would get wrong.
  const r1 = buildSessionRecord(ROUND_1, { ...OPTS, ts: 1_000 })!;
  assert.equal(r1.facts[I].firstTry, 1);
  assert.equal(r1.facts[I].firstTryHit, false);
});

test("each round is its own test occasion, so each moves the model's clock", () => {
  // Counts are identical between the two shapes (test one). BELIEF is not, and
  // this states the difference rather than leaving it to be discovered: three
  // rounds are three review() calls at three timestamps, where one record was
  // one. That is the intended reading — rounds are minutes of rest apart and
  // really are separate occasions — but it IS a change, and the last round's
  // timestamp is what `lastTested` ends on either way.
  const perRound = foldAll([
    buildSessionRecord(ROUND_1, { ...OPTS, ts: 1_000 })!,
    buildSessionRecord(ROUND_2, { ...OPTS, ts: 2_000 })!,
  ]);
  const oneShot = foldAll([
    buildSessionRecord(TOTAL_STATS, { ...OPTS, ts: 2_000 })!,
  ]);
  assert.equal(perRound[A].lastTested, 2_000);
  assert.equal(oneShot[A].lastTested, 2_000);
});

test("a round nobody answered produces no record", () => {
  // Not a smaller record — none. foldSession would otherwise be handed a
  // session with no facts in it, and the sessions list would grow a row for a
  // round that never happened.
  assert.equal(buildSessionRecord({}, { ...OPTS, ts: 1 }), null);
});

test("every record carries a distinct id, so a retry can be recognised", () => {
  const a = buildSessionRecord(ROUND_1, { ...OPTS, ts: 1_000 })!;
  const b = buildSessionRecord(ROUND_2, { ...OPTS, ts: 1_000 })!;
  assert.ok(a.id, "an id is minted with the record");
  assert.notEqual(a.id, b.id, "two records made in the same ms still differ");
  // And a caller may supply one, which is how a record keeps its identity
  // across the retries that make the queue safe.
  assert.equal(
    buildSessionRecord(ROUND_1, { ...OPTS, ts: 1_000, id: "fixed" })!.id,
    "fixed",
  );
});

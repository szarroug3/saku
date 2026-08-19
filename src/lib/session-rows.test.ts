// buildSessionListRows — SAK-23's read-side fix: Recent Sessions groups the
// per-round records `closeRound` still durably commits (one per round, on
// purpose — see quiz-session.tsx) back into one row per completed
// multi-round session, with the real count and score summed across the
// rounds instead of one round's alone.

import assert from "node:assert/strict";
import { test } from "node:test";

import { buildSessionListRows } from "@/lib/session-rows";
import { buildSessionRecord } from "@/lib/session-record";
import type { FactId, FactSessionDetail, QuizSessionRecord, SessionStats } from "@/types";

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
    confused: {},
    ...p,
  };
}

const OPTS = { mode: "drill" as const, redrill: false };

// Three rounds of the same session, roughly matching the ticket's repro: 3
// rounds, 10-11 questions answered per round, live accuracy varying across
// rounds (78% / 89% / 100%-ish).
const ROUND_1: SessionStats = {
  [A]: stat({ seen: 4, correct: 3 }),
  [I]: stat({ seen: 3, correct: 3 }),
  [U]: stat({ seen: 3, correct: 2 }),
};
const ROUND_2: SessionStats = {
  [A]: stat({ seen: 4, correct: 4 }),
  [I]: stat({ seen: 3, correct: 3 }),
  [U]: stat({ seen: 4, correct: 3 }),
};
const ROUND_3: SessionStats = {
  [A]: stat({ seen: 5, correct: 5 }),
  [I]: stat({ seen: 3, correct: 3 }),
  [U]: stat({ seen: 3, correct: 3 }),
};

function threeRoundSession(): QuizSessionRecord[] {
  const sessionId = "sess-1";
  return [
    buildSessionRecord(ROUND_1, { ...OPTS, ts: 1_000, sessionId })!,
    buildSessionRecord(ROUND_2, { ...OPTS, ts: 2_000, sessionId })!,
    buildSessionRecord(ROUND_3, { ...OPTS, ts: 3_000, sessionId })!,
  ];
}

test("three rounds of the same session collapse into ONE row", () => {
  const rows = buildSessionListRows(threeRoundSession());
  assert.equal(rows.length, 1, "one row, not three");
});

test("the merged row's count is the REAL total across every round, not one round's", () => {
  const rows = buildSessionListRows(threeRoundSession());
  // 10 + 11 + 11 = 32 real showings across the three rounds.
  assert.equal(rows[0].total, 32);
  assert.equal(rows[0].rounds, 3);
});

test("the merged row's score is the real pooled accuracy, not any one round's own", () => {
  const rows = buildSessionListRows(threeRoundSession());
  // correct: (3+3+2) + (4+3+3) + (5+3+3) = 8 + 10 + 11 = 29, over 32 seen.
  assert.equal(rows[0].forgivingPct, Math.round((100 * 29) / 32));
  // Not the artificial 100% every round would show under the old per-fact
  // reading (see session-record.test.ts) or under naively echoing any single
  // round's own already-fixed showings-based pct.
  assert.notEqual(rows[0].forgivingPct, 100);
});

test("the merged row reopens to the real detail, merged across rounds", () => {
  const rows = buildSessionListRows(threeRoundSession());
  const detail = rows[0].detail!;
  assert.equal(detail[A].seen, 4 + 4 + 5);
  assert.equal(detail[I].seen, 3 + 3 + 3);
  assert.equal(detail[U].seen, 3 + 4 + 3);
});

test("deleting the row must remove every underlying round record", () => {
  const records = threeRoundSession();
  const rows = buildSessionListRows(records);
  const ids = rows[0].ids;
  assert.equal(ids.length, 3);
  // Every underlying record's own id is represented — deleting the row and
  // stopping at just its own `.id` (the newest round's) would silently leave
  // the other two rounds behind as orphan history entries.
  for (const r of records) assert.ok(ids.includes(r.id!));
});

test("a session that only ran one round is still its own row, unchanged", () => {
  const only = buildSessionRecord(ROUND_1, {
    ...OPTS,
    ts: 1_000,
    sessionId: "sess-solo",
  })!;
  const rows = buildSessionListRows([only]);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].total, only.total);
  assert.equal(rows[0].forgivingPct, only.forgivingPct);
  assert.deepEqual(rows[0].ids, [only.id]);
});

test("records with no sessionId (one-off quizzes, or pre-SAK-23 records) never group", () => {
  const quizA = buildSessionRecord(ROUND_1, { ...OPTS, ts: 1_000 })!;
  const quizB = buildSessionRecord(ROUND_2, { ...OPTS, ts: 2_000 })!;
  const rows = buildSessionListRows([quizA, quizB]);
  assert.equal(rows.length, 2, "two independent quizzes stay two rows");
});

test("a mix of a grouped session and standalone quizzes produces the right row count", () => {
  const session = threeRoundSession();
  const quiz = buildSessionRecord(ROUND_1, { ...OPTS, ts: 9_000 })!;
  const rows = buildSessionListRows([...session, quiz]);
  assert.equal(rows.length, 2);
});

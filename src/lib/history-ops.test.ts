// The pure transforms behind every history write. history.test.ts pins these
// same behaviors through the server file (with all its temp-file/fsync/Supabase
// machinery); this pins them at the source, where a plain-Node test can reach
// them with no server-only stubbing at all — which is the whole reason the logic
// was lifted out of history.ts.
//
// Two properties matter beyond "does the arithmetic add up", because the browser
// now shares these functions:
//   1. THE INPUT IS NEVER MUTATED. history.ts used to modify the object it
//      loaded; a React caller holding that object would see it change under it.
//   2. THE NO-OP RETURNS THE SAME REFERENCE. saveSession's id-dedupe and
//      deleteSessions' empty-request both must NOT write to disk, and history.ts
//      decides that by `result !== input`. If a clone leaked out of a no-op, the
//      server would write on every duplicate post and every empty delete.

import assert from "node:assert/strict";
import { test } from "node:test";

import {
  applyClaims,
  applyDeleteSessions,
  applyDropClaims,
  applySeen,
  applySession,
  emptyHistory,
} from "@/lib/history-ops";
import type { FactId, HistoryFile, QuizSessionRecord } from "@/types";

const fid = (s: string) => s as unknown as FactId;

function seedSession(ts: number, id?: string): QuizSessionRecord {
  return {
    ...(id ? { id } : {}),
    ts,
    mode: "drill",
    redrill: false,
    total: 1,
    forgivingPct: 100,
    strictPct: 100,
    facts: {
      [fid("hira-a")]: { seen: 1, missed: 0, slow: 0, firstTry: 1, correct: 1 },
    } as QuizSessionRecord["facts"],
  };
}

// ---------- emptyHistory ----------

test("emptyHistory is the day-one shell, without claims/seen keys", () => {
  // resetAll serializes this and history.test.ts pins the exact bytes, so the
  // two optional keys must be ABSENT, not empty objects.
  assert.deepEqual(emptyHistory(), { sessions: [], facts: {} });
  assert.equal("claims" in emptyHistory(), false);
  assert.equal("seen" in emptyHistory(), false);
});

// ---------- claims ----------

test("applyClaims sets a timestamp per fact and does not mutate the input", () => {
  const before = emptyHistory();
  const after = applyClaims(before, [fid("kata-ka"), fid("kata-ki")], 2_000);
  assert.deepEqual(after.claims, { "kata-ka": 2_000, "kata-ki": 2_000 });
  assert.equal("claims" in before, false, "input untouched");
});

test("re-claiming moves the timestamp forward", () => {
  const first = applyClaims(emptyHistory(), [fid("hira-a")], 1_000);
  const second = applyClaims(first, [fid("hira-a")], 5_000);
  assert.equal(second.claims!["hira-a" as FactId], 5_000);
  assert.equal(first.claims!["hira-a" as FactId], 1_000, "the earlier result is unchanged");
});

test("applyDropClaims removes a claim and always returns a fresh object", () => {
  const claimed = applyClaims(emptyHistory(), [fid("hira-a"), fid("hira-i")], 1_000);
  const dropped = applyDropClaims(claimed, [fid("hira-a")]);
  assert.deepEqual(dropped.claims, { "hira-i": 1_000 });
  assert.notEqual(dropped, claimed, "a clone, even so a caller can diff");
  // Dropping a fact that was never claimed changes nothing but still clones.
  const noop = applyDropClaims(emptyHistory(), [fid("never")]);
  assert.deepEqual(noop.claims ?? {}, {});
});

// ---------- seen ----------

test("applySeen sets a timestamp per fact, on its own key", () => {
  const after = applySeen(emptyHistory(), [fid("hira-sa")], 3_000);
  assert.deepEqual(after.seen, { "hira-sa": 3_000 });
  assert.equal("claims" in after, false, "seen is not claims");
});

// ---------- sessions ----------

test("applySession appends and folds", () => {
  const after = applySession(emptyHistory(), seedSession(1_000));
  assert.equal(after.sessions.length, 1);
  assert.equal(after.facts[fid("hira-a")].seen, 1);
});

test("applySession is idempotent on id and returns the SAME reference (no-op)", () => {
  const first = applySession(emptyHistory(), seedSession(1_000, "round-1"));
  const again = applySession(first, seedSession(1_000, "round-1"));
  assert.equal(again, first, "same ref lets history.ts skip the write");
  assert.equal(again.sessions.length, 1, "counted once");
});

test("applySession still appends two id-less records", () => {
  const one = applySession(emptyHistory(), seedSession(1_000));
  const two = applySession(one, seedSession(1_001));
  assert.equal(two.sessions.length, 2);
  assert.equal(two.facts[fid("hira-a")].seen, 2);
});

test("applySession caps at 200 while the aggregate keeps the evicted counts", () => {
  let hist = emptyHistory();
  for (let i = 0; i < 250; i++) hist = applySession(hist, seedSession(1_000 + i));
  assert.equal(hist.sessions.length, 200, "the cap held");
  assert.equal(hist.facts[fid("hira-a")].seen, 250, "the aggregate counts all 250");
});

test("applySession does not mutate the input", () => {
  const before = emptyHistory();
  applySession(before, seedSession(1_000));
  assert.deepEqual(before.sessions, [], "input's sessions untouched");
  assert.deepEqual(before.facts, {}, "input's facts untouched");
});

// ---------- deletes ----------

test("applyDeleteSessions with nothing selected returns the SAME reference", () => {
  const hist = applySession(emptyHistory(), seedSession(1_000));
  assert.equal(applyDeleteSessions(hist, null, false), hist, "null is a no-op");
  assert.equal(applyDeleteSessions(hist, [], false), hist, "empty is a no-op");
});

test("applyDeleteSessions keys on id so same-ms records don't both go", () => {
  let hist = emptyHistory();
  hist = applySession(hist, seedSession(40_000, "keep"));
  hist = applySession(hist, seedSession(40_000, "drop")); // SAME ts
  const after = applyDeleteSessions(hist, ["drop"], false);
  assert.equal(after.sessions.length, 1);
  assert.equal(after.sessions[0].id, "keep");
  assert.equal(after.facts[fid("hira-a")].seen, 1, "aggregate rebuilt from the survivor");
});

test("applyDeleteSessions falls back to ts for id-less legacy records", () => {
  let hist = emptyHistory();
  hist = applySession(hist, seedSession(41_000));
  hist = applySession(hist, seedSession(42_000));
  const after = applyDeleteSessions(hist, [41_000], false);
  assert.equal(after.sessions.length, 1);
  assert.equal(after.sessions[0].ts, 42_000);
});

test("applyDeleteSessions deleteAll clears sessions and the aggregate", () => {
  let hist = emptyHistory();
  hist = applySession(hist, seedSession(1_000));
  const after = applyDeleteSessions(hist, null, true);
  assert.deepEqual(after.sessions, []);
  assert.deepEqual(after.facts, {});
});

test("applyDeleteSessions preserves claims and seen (rebuilds only facts)", () => {
  let hist = emptyHistory();
  hist = applySession(hist, seedSession(1_000, "a"));
  hist = applyClaims(hist, [fid("kata-ka")], 2_000);
  hist = applySeen(hist, [fid("hira-sa")], 3_000);
  const after = applyDeleteSessions(hist, ["a"], false);
  assert.deepEqual(after.sessions, [], "the session went");
  assert.deepEqual(after.claims, { "kata-ka": 2_000 }, "claims survive a delete");
  assert.deepEqual(after.seen, { "hira-sa": 3_000 }, "seen survives a delete");
});

// A cross-check that the shared op and the aggregate agree with each other the
// way history.ts's incremental fold and its rebuild must.
test("a delete-driven rebuild matches the sum of what survives", () => {
  let hist: HistoryFile = emptyHistory();
  hist = applySession(hist, seedSession(1_000, "a"));
  hist = applySession(hist, seedSession(2_000, "b"));
  hist = applySession(hist, seedSession(3_000, "c"));
  const after = applyDeleteSessions(hist, ["b"], false);
  assert.equal(after.facts[fid("hira-a")].seen, 2, "two survivors, seen twice");
});

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
  applyClearMixup,
  applyClaims,
  applyDeleteSessions,
  applyDropClaims,
  applyDropSeen,
  applySeen,
  applySession,
  deriveLearnedAt,
  emptyHistory,
  withBackfilledLearnedAt,
} from "@/lib/history-ops";
import { isFactFresh } from "@/lib/content/unit-scheduler-core";
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
      [fid("hira-a")]: { seen: 1, missed: 0, firstTry: 1, correct: 1 },
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

test("applyClearMixup records a monotonic floor without mutating history", () => {
  const before = emptyHistory();
  const first = applyClearMixup(before, "あ·お", 2_000);
  const olderRetry = applyClearMixup(first, "あ·お", 1_000);
  assert.deepEqual(olderRetry.clearedMixups, { "あ·お": 2_000 });
  assert.equal("clearedMixups" in before, false, "input untouched");
});

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

// ---------- SAK-103: dropping a claim must also clear the fact's aggregate ----------

test("applyDropClaims also deletes history.facts[f] — a claim withdrawal on an independently-quizzed fact goes back to true fresh", () => {
  // Mirrors a real prod record (word:だ/meaning): quizzed 9 times to a real
  // aggregate, THEN claimed, THEN the claim withdrawn via Library "mark as not
  // known". Before SAK-103's fix, claims went away but facts[f] did not, so
  // effectiveState (claims.ts) kept reading it as tested via agg.lastTested and
  // isFactFresh (unit-scheduler-core.ts) never saw it as due again.
  const quizzed = applySession(emptyHistory(), {
    ts: 5_000,
    mode: "drill",
    redrill: false,
    total: 1,
    forgivingPct: 100,
    strictPct: 100,
    facts: {
      [fid("word:だ/meaning")]: { seen: 9, missed: 0, correct: 9, firstTry: 9 },
    } as QuizSessionRecord["facts"],
  });
  assert.ok(quizzed.facts[fid("word:だ/meaning")]?.lastTested, "a real aggregate exists");

  const claimed = applyClaims(quizzed, [fid("word:だ/meaning")], 6_000);
  const dropped = applyDropClaims(claimed, [fid("word:だ/meaning")]);

  assert.equal("word:だ/meaning" in (dropped.claims ?? {}), false, "claim is gone");
  assert.equal(
    "word:だ/meaning" in dropped.facts,
    false,
    "the quiz aggregate is ALSO gone, not just the claim",
  );
  assert.notEqual(dropped, claimed, "still a clone");
  // The input is untouched, per the pure-transform contract.
  assert.ok(claimed.facts[fid("word:だ/meaning")], "input's aggregate is unaffected");

  const fresh = isFactFresh(fid("word:だ/meaning"), dropped);
  assert.equal(fresh, true, "isFactFresh now reports the reset word as due again");
});

test("applyDropClaims on a fact with NO facts aggregate (kana-like) still behaves as before — regression guard", () => {
  // Kana facts in real history are tracked purely via claims/learnedAt and never
  // get an independent facts[] aggregate, which is why the bug never showed up
  // there. Dropping such a claim should be unaffected by the new facts-delete.
  const claimed = applyClaims(emptyHistory(), [fid("hira-a")], 1_000);
  assert.equal("hira-a" in claimed.facts, false, "no aggregate, exactly like real kana history");

  const dropped = applyDropClaims(claimed, [fid("hira-a")]);
  assert.deepEqual(dropped.claims ?? {}, {});
  assert.deepEqual(dropped.facts, {}, "still nothing there — nothing to delete, nothing added");
  assert.equal(isFactFresh(fid("hira-a"), dropped), true, "fresh, as it always was for kana");
});

// ---------- seen ----------

test("applySeen sets a timestamp per fact, on its own key", () => {
  const after = applySeen(emptyHistory(), [fid("hira-sa")], 3_000);
  assert.deepEqual(after.seen, { "hira-sa": 3_000 });
  assert.equal("claims" in after, false, "seen is not claims");
});

test("applyDropSeen removes a seen mark and always returns a fresh object", () => {
  const seen = applySeen(emptyHistory(), [fid("hira-sa"), fid("hira-si")], 3_000);
  const dropped = applyDropSeen(seen, [fid("hira-sa")]);
  assert.deepEqual(dropped.seen, { "hira-si": 3_000 }, "only the named mark goes");
  assert.notEqual(dropped, seen, "a clone, so a caller can diff");
  assert.deepEqual(seen.seen, { "hira-sa": 3_000, "hira-si": 3_000 }, "input untouched");
  // Un-seeing a fact that was never seen changes nothing but still clones.
  const noop = applyDropSeen(emptyHistory(), [fid("never")]);
  assert.deepEqual(noop.seen ?? {}, {});
});

test("applyDropSeen inverts applySeen exactly", () => {
  const facts = [fid("hira-a"), fid("hira-i")];
  const base = emptyHistory();
  const roundTrip = applyDropSeen(applySeen(base, facts, 9_000), facts);
  // An absent `seen` key is how "never seen" is spelled; after the round trip
  // there is nothing left to say a fact was seen.
  assert.deepEqual(roundTrip.seen ?? {}, {});
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

// ---------- learnedAt (first-learned, keep-earliest) ----------

test("applySeen stamps learnedAt at the seen time", () => {
  const h = applySeen(emptyHistory(), [fid("hira-a")], 100);
  assert.equal(h.seen?.[fid("hira-a")], 100);
  assert.equal(h.learnedAt?.[fid("hira-a")], 100);
});

test("applyClaims stamps learnedAt at the claim time", () => {
  const h = applyClaims(emptyHistory(), [fid("hira-a")], 100);
  assert.equal(h.claims?.[fid("hira-a")], 100);
  assert.equal(h.learnedAt?.[fid("hira-a")], 100);
});

test("applySession stamps learnedAt at the session ts", () => {
  const h = applySession(emptyHistory(), seedSession(500, "s1"));
  assert.equal(h.learnedAt?.[fid("hira-a")], 500);
});

test("re-recording a LATER seen/claim does not move learnedAt forward", () => {
  let h = applySeen(emptyHistory(), [fid("hira-a")], 100);
  h = applySeen(h, [fid("hira-a")], 300);
  assert.equal(h.seen?.[fid("hira-a")], 300, "seen moves forward");
  assert.equal(h.learnedAt?.[fid("hira-a")], 100, "learnedAt keeps the earliest");

  h = applyClaims(h, [fid("hira-a")], 400);
  assert.equal(h.learnedAt?.[fid("hira-a")], 100, "a later claim doesn't move it");
});

test("an EARLIER session moves learnedAt earlier", () => {
  let h = applySession(emptyHistory(), seedSession(300, "late"));
  assert.equal(h.learnedAt?.[fid("hira-a")], 300);
  h = applySession(h, seedSession(100, "early"));
  assert.equal(h.learnedAt?.[fid("hira-a")], 100, "the earlier session wins");
});

test("deriveLearnedAt picks the earliest across sessions, claims and seen", () => {
  const hist: HistoryFile = {
    sessions: [seedSession(500, "s")],
    facts: {},
    claims: { [fid("hira-a")]: 200, [fid("kata-ka")]: 900 } as Record<
      FactId,
      number
    >,
    seen: { [fid("hira-a")]: 800 } as Record<FactId, number>,
  };
  const derived = deriveLearnedAt(hist);
  // hira-a is in a session (500), a claim (200) and a seen (800) → earliest 200.
  assert.equal(derived[fid("hira-a")], 200);
  // kata-ka only has a claim.
  assert.equal(derived[fid("kata-ka")], 900);
});

test("withBackfilledLearnedAt lets an existing learnedAt entry win", () => {
  const hist: HistoryFile = {
    sessions: [seedSession(500, "s")],
    facts: {},
    // Going-forward value is authoritative-earliest even though the session ts
    // (500) is smaller — an existing entry is never overwritten by derivation.
    learnedAt: { [fid("hira-a")]: 700 } as Record<FactId, number>,
  };
  const out = withBackfilledLearnedAt(hist);
  assert.equal(out.learnedAt?.[fid("hira-a")], 700, "existing entry preserved");
});

test("withBackfilledLearnedAt fills a missing fact and tolerates empty history", () => {
  const filled = withBackfilledLearnedAt({
    sessions: [seedSession(500, "s")],
    facts: {},
  });
  assert.equal(filled.learnedAt?.[fid("hira-a")], 500);

  const empty = withBackfilledLearnedAt({ sessions: [], facts: {} });
  assert.deepEqual(empty.learnedAt, {}, "empty history → empty map, no throw");
});

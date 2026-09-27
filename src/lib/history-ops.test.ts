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
  applyDeleteSessionsMeta,
  applyDropClaims,
  applyDropClaimsMeta,
  applyDropSeen,
  applySeen,
  applySession,
  applySessionMeta,
  applyUnlearn,
  deriveLearnedAt,
  emptyHistory,
  isFactMet,
  normalizeHistoryShell,
  unmetFacts,
  withBackfilledLearnedAt,
} from "@/lib/history-ops";
import { isFactFresh } from "@/lib/content/unit-scheduler-core";
import type { FactId } from "@/types/facts";
import type { HistoryFile, QuizSessionRecord } from "@/types/store";

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

// 2026-09-27. Sam opened を in a lesson, which marks it seen, and the Sky reads
// a seen fact as met: off the Observatory, known on the Atlas. "I don't know
// this" only withdrew a claim she had never made, so nothing changed.
test("applyDropClaims also takes back the seen mark and the learnedAt stamp a lesson made, so the fact is brand new", () => {
  const seen = applySeen(emptyHistory(), [fid("grammar:wo"), fid("grammar:wa")], 1_000);
  assert.equal(seen.seen![fid("grammar:wo")], 1_000);
  assert.equal(seen.learnedAt![fid("grammar:wo")], 1_000);

  const dropped = applyDropClaims(seen, [fid("grammar:wo")]);

  assert.equal(fid("grammar:wo") in (dropped.seen ?? {}), false, "the seen mark is gone");
  assert.equal(fid("grammar:wo") in (dropped.learnedAt ?? {}), false, "and so is the stamp, so the next lesson to open it is the first");
  assert.equal(dropped.seen![fid("grammar:wa")], 1_000, "the other fact keeps both");
  assert.equal(dropped.learnedAt![fid("grammar:wa")], 1_000);
  assert.equal(seen.seen![fid("grammar:wo")], 1_000, "the input is untouched");
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

// ---------- SAK-237: the META-ONLY variants history.ts's server mutators use
// to fold/delete facts against their OWN table instead of the whole document
// (see fact-store.ts and store/supabase-store.ts's progress_facts). These must
// match their whole-document counterparts on EVERY field except `.facts`,
// which they must leave completely alone. ----------

test("applySessionMeta matches applySession on sessions/learnedAt, but never touches facts", () => {
  const start: HistoryFile = { ...emptyHistory(), facts: { [fid("preexisting")]: { seen: 9 } as HistoryFile["facts"][FactId] } };
  const viaFull = applySession(start, seedSession(500, "s1"));
  const viaMeta = applySessionMeta(start, seedSession(500, "s1"));

  assert.deepEqual(viaMeta.sessions, viaFull.sessions);
  assert.deepEqual(viaMeta.learnedAt, viaFull.learnedAt);
  assert.equal(viaMeta.facts, start.facts, "the SAME reference — no clone, no fold, no read");
});

test("applySessionMeta honors the id-dedup no-op contract", () => {
  const withOne = applySessionMeta(emptyHistory(), seedSession(500, "dup"));
  const again = applySessionMeta(withOne, seedSession(999, "dup"));
  assert.equal(again, withOne, "same reference: a retried id changes nothing");
});

test("applySessionMeta caps sessions at 200, exactly like applySession", () => {
  let full = emptyHistory();
  let meta = emptyHistory();
  for (let i = 0; i < 205; i++) {
    full = applySession(full, seedSession(i, `s${i}`));
    meta = applySessionMeta(meta, seedSession(i, `s${i}`));
  }
  assert.equal(meta.sessions.length, 200);
  assert.deepEqual(
    meta.sessions.map((s) => s.id),
    full.sessions.map((s) => s.id),
  );
});

test("applyDropClaimsMeta drops the claim, the seen mark and the stamp, but leaves facts completely untouched", () => {
  const start: HistoryFile = {
    ...emptyHistory(),
    claims: { [fid("a")]: 1, [fid("b")]: 2 } as HistoryFile["claims"],
    seen: { [fid("a")]: 3, [fid("b")]: 4 } as HistoryFile["seen"],
    learnedAt: { [fid("a")]: 1, [fid("b")]: 2 } as HistoryFile["learnedAt"],
    facts: { [fid("a")]: { seen: 9 } as HistoryFile["facts"][FactId] },
  };
  const out = applyDropClaimsMeta(start, [fid("a")]);
  assert.deepEqual(out.claims, { [fid("b")]: 2 });
  assert.deepEqual(out.seen, { [fid("b")]: 4 });
  assert.deepEqual(out.learnedAt, { [fid("b")]: 2 });
  assert.equal(out.facts, start.facts, "same reference — applyDropClaims' facts-delete is NOT done here");
});

test("applyDeleteSessionsMeta matches applyDeleteSessions' session filtering, but never touches facts", () => {
  const start = applySession(
    applySession(emptyHistory(), seedSession(100, "s1")),
    { ...seedSession(200, "s2"), facts: { [fid("hira-b")]: { seen: 1, missed: 0, firstTry: 1, correct: 1 } } as QuizSessionRecord["facts"] },
  );

  const viaFull = applyDeleteSessions(start, ["s1"], false);
  const viaMeta = applyDeleteSessionsMeta(start, ["s1"], false);

  assert.deepEqual(viaMeta.sessions, viaFull.sessions);
  assert.equal(viaMeta.facts, start.facts, "no rebuild — that half moves to replaceAllFactRows in history.ts");
});

test("applyDeleteSessionsMeta honors the empty-selection no-op contract", () => {
  const start = applySession(emptyHistory(), seedSession(100, "s1"));
  const out = applyDeleteSessionsMeta(start, [], false);
  assert.equal(out, start, "same reference: nothing selected, nothing changes");
});

// SAK-492. A Sky lesson left part way through is forgotten from the
// Observatory's X, or from Sessions. Opening a star marked its facts seen, and
// for the facts that mark was the first one on, it also stamped learnedAt; the
// sitting keeps those fact ids, and forgetting hands them to applyUnlearn.

/** What a lesson step does: the facts with no learnedAt before the seen write
 * are the ones this sitting marked first (seeId in src/app/(sky)/writes.ts). */
function openStar(hist: HistoryFile, facts: FactId[], ts: number): { hist: HistoryFile; first: FactId[] } {
  const before = hist.learnedAt ?? {};
  return { hist: applySeen(hist, facts, ts), first: facts.filter((f) => before[f] == null) };
}

function quizOn(fact: FactId, ts: number): QuizSessionRecord {
  return {
    id: `quiz-${ts}`,
    ts,
    mode: "drill",
    redrill: false,
    total: 1,
    forgivingPct: 100,
    strictPct: 100,
    facts: { [fact]: { seen: 1, missed: 0, firstTry: 1, correct: 1 } } as QuizSessionRecord["facts"],
  };
}

test("forgetting a lesson makes everything it marked brand new, quizzed in its rounds or not, and leaves the rest", () => {
  const earlier = fid("pattern-wa");
  const a = fid("pattern-wo");
  const b = fid("pattern-ni");
  // an earlier lesson marked は, and nobody quizzed it
  let hist = applySeen(emptyHistory(), [earlier], 1_000);
  // this sitting opens two stars, and opens は again on the way
  const one = openStar(hist, [a, earlier], 2_000);
  const two = openStar(one.hist, [b], 3_000);
  hist = two.hist;
  const marked = [...one.first, ...two.first];
  assert.deepEqual(marked, [a, b], "は was met before, so it is not the sitting's to keep");
  // に is drilled in the lesson's own round
  hist = applySession(hist, quizOn(b, 4_000));
  assert.ok(hist.facts[b], "and has an aggregate for it");

  const after = applyUnlearn(hist, marked);
  assert.equal(after.seen?.[a], undefined, "を: its seen mark goes");
  assert.equal(after.learnedAt?.[a], undefined, "and so does its learnedAt stamp");
  assert.equal(after.seen?.[b], undefined, "に: quizzed in the round, and it goes just the same (2026-09-27)");
  assert.equal(after.learnedAt?.[b], undefined);
  assert.equal(after.facts[b], undefined, "with its aggregate");
  assert.equal(after.seen?.[earlier], 2_000, "は is the earlier lesson's, and is not touched");
  assert.equal(after.learnedAt?.[earlier], 1_000);
  // the session stays, as what happened; it stamps に again on a read, and
  // that stamp is not what makes a fact met
  assert.equal(after.sessions.length, 1);
  assert.equal(isFactMet(normalizeHistoryShell(after), b), false);
  assert.equal(isFactMet(normalizeHistoryShell(after), a), false);
  assert.equal(isFactMet(normalizeHistoryShell(after), earlier), true);
  assert.notEqual(after, hist, "a clone");
  assert.equal(hist.seen?.[a], 2_000, "input untouched");
});

test("forgetting a lesson leaves a claimed fact alone", () => {
  const claimed = fid("hira-wa");
  const folded = fid("hira-wo");
  let hist = applySeen(emptyHistory(), [claimed, folded], 2_000);
  hist = applyClaims(hist, [claimed], 3_000);
  // an aggregate with no stored session behind it: one the 200 cap evicted
  hist = { ...hist, facts: { ...hist.facts, [folded]: applySession(emptyHistory(), quizOn(folded, 2_500)).facts[folded] } };
  const after = applyUnlearn(hist, [claimed, folded]);
  assert.equal(after.seen?.[claimed], 2_000, "a claim is the learner's word, and forgetting a lesson is not the opposite");
  assert.equal(after.learnedAt?.[claimed], 2_000);
  assert.equal(after.claims?.[claimed], 3_000);
  assert.equal(after.seen?.[folded], undefined, "the folded one is reset, aggregate and all");
  assert.equal(after.facts[folded], undefined);
});

// The Sky's reading of met, in one place for the write that asks which facts
// a lesson finds new and the page that shows what is met (learner.ts).
test("isFactMet reads an answer, a claim or a lesson's seen mark, and nothing else", () => {
  const answered = fid("k-a"), claimed = fid("k-i"), opened = fid("k-u"), stamped = fid("k-e"), never = fid("k-o");
  let hist = applySession(emptyHistory(), quizOn(answered, 1_000));
  hist = applyClaims(hist, [claimed], 2_000);
  hist = applySeen(hist, [opened], 3_000);
  hist = { ...hist, learnedAt: { ...hist.learnedAt, [stamped]: 4_000 } };
  assert.equal(isFactMet(hist, answered), true);
  assert.equal(isFactMet(hist, claimed), true);
  assert.equal(isFactMet(hist, opened), true);
  assert.equal(isFactMet(hist, stamped), false, "a stamp alone is derived, not a meeting");
  assert.equal(isFactMet(hist, never), false);
  assert.deepEqual(unmetFacts(hist, [answered, claimed, opened, stamped, never]), [stamped, never]);
});

// Run: node --import ./src/lib/conjugate/test-hooks.mjs --test \
//        src/lib/session-state.test.ts
//
// The pure core of in-progress session sync (Sync Part 2): the envelope, the
// last-writer-wins reconcile, and the completed-clears-the-blob rule. Everything
// here is decided without a network, a DOM, or React — the client provider, the
// API route and these tests all share this one module — so the three rules the
// feature turns on are pinned here:
//
//   1. a runtime → blob → runtime round-trip is FAITHFUL (position and all),
//   2. the NEWER updatedAt wins a reconcile (the teleport), and
//   3. a completed run's CLEAR (a newer null) drops the run everywhere it lands
//      (no resurrecting a finished run from a stale in-progress copy).

import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  EMPTY_ENVELOPE,
  clearedEnvelope,
  envelopeHasSession,
  makeEnvelope,
  normalizeEnvelope,
  pickNewer,
  reconcile,
  type SessionPayload,
} from "./session-state.ts";

/** A representative in-progress payload: a drill mid-question (deck position,
 * current card, attempts, per-showing stats) inside a session loop (phase +
 * round), plus a parked run. This is the shape quiz-session.tsx's syncPayload
 * produces — kept opaque by the module, so we assert it survives verbatim. */
function samplePayload(): SessionPayload {
  return {
    active: {
      facts: ["kana:a", "kana:i"],
      what: "Hiragana · vowels",
      redrill: false,
      forceCoverage: false,
      legId: "leg-1",
      startedAt: 1000,
      snapshot: { mode: "drill", dirs: { jp2en: true }, length: "limited" },
      runtime: {
        deck: ["kana:a", "kana:i", "kana:a"],
        pos: 2,
        asked: 2,
        resolved: 1,
        requeued: 1,
        streak: 0,
        stats: { "kana:a": { seen: 1, misses: 1, everCorrect: false } },
        q: { f: "kana:i", dir: "jp2en", tries: 1, hinted: false, confused: null },
        waiting: false,
        timerLeft: null,
        elapsedMs: 4200,
        firstKeyMs: 900,
      },
    },
    session: {
      facts: ["kana:a", "kana:i"],
      teach: ["kana:a"],
      what: "Hiragana · vowels",
      round: 2,
      // The teach walk's cursor — the exact-position teach resume rides here on
      // the session, so a teleport lands the learner on the same page.
      teachStep: 3,
      phase: "drilling",
      restUntil: null,
      roundStats: {},
      recovered: [],
      rounds: [{ round: 1, total: 2, firstTry: 1, missed: 1 }],
      totalStats: {},
      lastActiveAt: 2000,
      origin: "lesson",
    },
    progress: { done: 1, total: 3 },
    parked: [
      { id: "run-9", active: null, session: { phase: "resting" }, progress: null, parkedAt: 500 },
    ],
  };
}

describe("normalizeEnvelope", () => {
  test("garbage and absence read as the empty envelope", () => {
    for (const raw of [null, undefined, 42, "x", [], true]) {
      assert.deepEqual(normalizeEnvelope(raw), EMPTY_ENVELOPE);
    }
  });

  test("a non-object / array state is dropped to null (a corrupt run is no run)", () => {
    assert.equal(normalizeEnvelope({ sessionId: "s", updatedAt: 5, state: [1, 2] }).state, null);
    assert.equal(normalizeEnvelope({ sessionId: "s", updatedAt: 5, state: 7 }).state, null);
  });

  test("a non-finite / missing updatedAt reads as 0 so any real write beats it", () => {
    assert.equal(normalizeEnvelope({ sessionId: "s", state: {} }).updatedAt, 0);
    assert.equal(
      normalizeEnvelope({ sessionId: "s", updatedAt: Infinity, state: {} }).updatedAt,
      0,
    );
  });

  test("a well-formed envelope passes through intact", () => {
    const env = { sessionId: "s", updatedAt: 12, state: { active: null } };
    assert.deepEqual(normalizeEnvelope(env), env);
  });
});

describe("round-trip faithfulness (runtime → blob → runtime)", () => {
  test("the in-progress payload survives the wire byte-for-byte", () => {
    const payload = samplePayload();
    const env = makeEnvelope(payload, "sess-1", 1234);
    // Through JSON exactly as it goes to the column / file and back.
    const wire = JSON.parse(JSON.stringify(env));
    const back = normalizeEnvelope(wire);
    assert.equal(back.sessionId, "sess-1");
    assert.equal(back.updatedAt, 1234);
    // The whole payload — deck position, current question, attempts, stats,
    // session phase/round, and the parked run — is faithful.
    assert.deepEqual(back.state, payload);
  });

  test("the cursor specifically survives — pos, question index, phase, round", () => {
    const payload = samplePayload();
    const back = normalizeEnvelope(JSON.parse(JSON.stringify(makeEnvelope(payload, "s", 1))));
    const rt = (back.state as SessionPayload).active as Record<string, unknown>;
    const runtime = rt.runtime as Record<string, unknown>;
    assert.equal(runtime.pos, 2);
    assert.equal(runtime.resolved, 1);
    assert.deepEqual((runtime.q as Record<string, unknown>).f, "kana:i");
    const s = (back.state as SessionPayload).session as Record<string, unknown>;
    assert.equal(s.phase, "drilling");
    assert.equal(s.round, 2);
  });

  test("the teach-walk cursor survives — page N restores to page N", () => {
    const payload = samplePayload();
    const back = normalizeEnvelope(JSON.parse(JSON.stringify(makeEnvelope(payload, "s", 1))));
    const s = (back.state as SessionPayload).session as Record<string, unknown>;
    // Left the walk on item 3; it comes back on item 3, not reset to the first.
    assert.equal(s.teachStep, 3);
  });
});

describe("last-writer-wins reconcile", () => {
  test("the newer updatedAt wins (the teleport: server run adopted on a fresh device)", () => {
    const local = EMPTY_ENVELOPE; // fresh device, no run
    const remote = makeEnvelope(samplePayload(), "sess-1", 5000);
    const { winner, adoptRemote } = reconcile(local, remote);
    assert.equal(adoptRemote, true);
    assert.equal(winner, remote);
    assert.ok(envelopeHasSession(winner));
  });

  test("a fresher LOCAL run is kept, not clobbered by an older server copy", () => {
    const local = makeEnvelope(samplePayload(), "sess-1", 9000);
    const remote = makeEnvelope(samplePayload(), "sess-1", 3000);
    const { winner, adoptRemote } = reconcile(local, remote);
    assert.equal(adoptRemote, false);
    assert.equal(winner, local);
  });

  test("a tie prefers the local device (it is the one holding the live run)", () => {
    const local = makeEnvelope(samplePayload(), "a", 7000);
    const remote = makeEnvelope(samplePayload(), "b", 7000);
    assert.equal(pickNewer(local, remote), local);
    assert.equal(reconcile(local, remote).adoptRemote, false);
  });
});

describe("completed run clears its in-progress blob", () => {
  test("a newer CLEAR drops the run when reconciled against a held in-progress copy", () => {
    // Device B is holding the run in progress...
    const held = makeEnvelope(samplePayload(), "sess-1", 1000);
    // ...device A finished it and published a clear a moment later.
    const cleared = clearedEnvelope("sess-1", 2000);
    const { winner, adoptRemote } = reconcile(held, cleared);
    assert.equal(adoptRemote, true);
    assert.equal(envelopeHasSession(winner), false, "the finished run must not survive");
    assert.equal(winner.state, null);
  });

  test("a clear does NOT undo a run that was started again even later (LWW holds)", () => {
    // A clear at t=2000, then a brand-new run at t=3000 wins over the clear.
    const cleared = clearedEnvelope("sess-1", 2000);
    const fresh = makeEnvelope(samplePayload(), "sess-2", 3000);
    assert.equal(pickNewer(cleared, fresh), fresh);
    assert.ok(envelopeHasSession(pickNewer(cleared, fresh)));
  });

  test("envelopeHasSession is the has-a-run test the resume surface reads", () => {
    assert.equal(envelopeHasSession(EMPTY_ENVELOPE), false);
    assert.equal(envelopeHasSession(clearedEnvelope("s", 1)), false);
    assert.equal(envelopeHasSession(makeEnvelope(samplePayload(), "s", 1)), true);
  });
});

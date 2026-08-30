// Run: node --import ./src/lib/conjugate/test-hooks.mjs --test \
//        src/lib/session-mutate.test.ts
//
// THE BUG THESE PIN (SAK-260)
// ============================
// session-store.ts's saveSessionState already had a "pick the newer envelope"
// reconcile (pickNewer, in session-state.ts) — but pre-fix it ran over a plain
// read-then-write with no concurrency guard: load the row, pick a winner
// against THAT snapshot, write the winner back, unconditionally. Two devices
// posting near-simultaneously each read the same row, each independently
// decide their own update is the winner, and each blindly overwrite — so
// whichever write lands SECOND wins outright, even when it is not the one that
// actually carried the newer `updatedAt`. The intended reconcile logic never
// even ran against the row's real final state.
//
// mutateSessionStateWithRetry closes it with the same optimistic concurrency
// history/lists/settings have: a write lands only if the row still carries the
// token the read saw, and a miss re-reads the winner and re-reconciles. The
// first test reproduces the exact race from the ticket: two devices each post
// an update to the same in-progress round within the same window, and the
// actually-newer one must win regardless of which request's write reaches the
// database first.

import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  mutateSessionStateWithRetry,
  type SessionStore,
  type SessionVersionedRead,
} from "@/lib/session-mutate";
import { pickNewer, type SessionStateEnvelope } from "@/lib/session-state";

const USER = "user-1";

/**
 * An in-memory store that models the real compare-and-set exactly: a write
 * lands only if the row still carries the token the caller read (or, for the
 * first row, only if none exists yet). `onRead` fires ONCE, right after a read
 * snapshots the state and before it returns — the hook a test uses to run a
 * competing writer "in between", which is how a real overlap is reproduced
 * deterministically. Modelled on settings-mutate.test.ts's CasStore.
 */
class CasStore implements SessionStore {
  state: { envelope: SessionStateEnvelope; version: string | null; exists: boolean };
  seq = 0;
  reads = 0;
  writeAttempts = 0;
  conflicts = 0;
  onRead?: () => Promise<void>;

  constructor(seed?: { envelope: SessionStateEnvelope; version: string }) {
    this.state = seed
      ? { envelope: seed.envelope, version: seed.version, exists: true }
      : { envelope: { sessionId: null, updatedAt: 0, state: null }, version: null, exists: false };
  }

  async read(): Promise<SessionVersionedRead> {
    this.reads++;
    const snapshot: SessionVersionedRead = {
      envelope: structuredClone(this.state.envelope),
      version: this.state.version,
      exists: this.state.exists,
    };
    const hook = this.onRead;
    if (hook) {
      this.onRead = undefined;
      await hook();
    }
    return snapshot;
  }

  async write(
    _userId: string,
    next: SessionStateEnvelope,
    expected: SessionVersionedRead,
  ): Promise<boolean> {
    this.writeAttempts++;
    const wins = expected.exists
      ? this.state.exists && this.state.version === expected.version
      : !this.state.exists;
    if (!wins) {
      this.conflicts++;
      return false;
    }
    this.state = {
      envelope: structuredClone(next),
      version: `v${++this.seq}`,
      exists: true,
    };
    return true;
  }
}

/** One device's post, exactly what session-store.ts's saveSessionState does:
 * reconcile the incoming envelope against whatever the row holds. */
function post(store: SessionStore, incoming: SessionStateEnvelope): Promise<SessionStateEnvelope> {
  return mutateSessionStateWithRetry(store, USER, (stored) => pickNewer(stored, incoming));
}

describe("two devices updating the same in-progress round in the same window (SAK-260)", () => {
  test("the actually-newer update wins even when the older device's write reaches the store second", async () => {
    // Both devices start from the same stored round.
    const store = new CasStore({
      envelope: { sessionId: "round-1", updatedAt: 100, state: { cursor: 0 } },
      version: "seed",
    });

    // Device A (the OLDER update, updatedAt: 150) runs to completion in between
    // device B's read and write. Pre-fix, this is exactly the race: B read the
    // row before A's write landed, decided its own (newer, updatedAt: 200)
    // envelope beat what it read, and then blindly overwrote — except so did A,
    // and whichever finished last simply won regardless of timestamp. Here A
    // finishes second (nested inside B's onRead), so pre-fix A's stale write
    // would clobber B's newer one.
    store.onRead = async () => {
      await post(store, { sessionId: "round-1", updatedAt: 150, state: { cursor: 1 } });
    };

    const result = await post(store, { sessionId: "round-1", updatedAt: 200, state: { cursor: 2 } });

    // The newer envelope (updatedAt: 200) must be what is actually stored,
    // never the older one that merely happened to write last.
    assert.deepEqual(result, { sessionId: "round-1", updatedAt: 200, state: { cursor: 2 } });
    assert.deepEqual(store.state.envelope, {
      sessionId: "round-1",
      updatedAt: 200,
      state: { cursor: 2 },
    });
    assert.ok(store.conflicts >= 1, "the losing write hit a CAS conflict and retried");
  });

  test("a stale post loses to a genuinely newer stored round, even after retrying", async () => {
    const store = new CasStore({
      envelope: { sessionId: "round-1", updatedAt: 100, state: { cursor: 0 } },
      version: "seed",
    });

    // Someone else's write (newer) lands between our read and our write.
    store.onRead = async () => {
      await post(store, { sessionId: "round-1", updatedAt: 300, state: { cursor: 9 } });
    };

    // Our own post is older than what is now stored.
    const result = await post(store, { sessionId: "round-1", updatedAt: 150, state: { cursor: 1 } });

    assert.deepEqual(result, { sessionId: "round-1", updatedAt: 300, state: { cursor: 9 } });
    assert.deepEqual(store.state.envelope, {
      sessionId: "round-1",
      updatedAt: 300,
      state: { cursor: 9 },
    });
  });

  test("a newer CLEAR is never un-cleared by a straggling in-progress write", async () => {
    const store = new CasStore({
      envelope: { sessionId: "round-1", updatedAt: 100, state: { cursor: 0 } },
      version: "seed",
    });

    // The finishing device's clear lands in between.
    store.onRead = async () => {
      await post(store, { sessionId: "round-1", updatedAt: 500, state: null });
    };

    // A stale in-progress write from a device that had not yet heard the round
    // finished.
    const result = await post(store, { sessionId: "round-1", updatedAt: 200, state: { cursor: 2 } });

    assert.equal(result.state, null, "the clear stands — the round stays finished");
    assert.equal(store.state.envelope.state, null);
  });

  test("a no-op post (ours loses outright) writes nothing and contends for no row", async () => {
    const store = new CasStore({
      envelope: { sessionId: "round-1", updatedAt: 100, state: { cursor: 5 } },
      version: "seed",
    });

    const result = await post(store, { sessionId: "round-1", updatedAt: 10, state: { cursor: 0 } });

    assert.deepEqual(result, { sessionId: "round-1", updatedAt: 100, state: { cursor: 5 } });
    assert.equal(store.writeAttempts, 0, "the stored envelope already won — nothing to write");
  });

  test("a write that can never land throws rather than reporting a false success", async () => {
    // Sustained contention: the route turns this into a 500, so the client's
    // reliable-write path retries instead of believing an unsynced round saved.
    const jammed: SessionStore = {
      read: async () => ({
        envelope: { sessionId: "round-1", updatedAt: 1, state: { cursor: 0 } },
        version: "x",
        exists: true,
      }),
      write: async () => false,
    };
    await assert.rejects(
      () =>
        mutateSessionStateWithRetry(
          jammed,
          USER,
          (stored) => pickNewer(stored, { sessionId: "round-1", updatedAt: 999, state: { cursor: 1 } }),
          3,
        ),
      /lost to concurrent writers 3 times/,
    );
  });

  test("the first write on an empty row inserts", async () => {
    const store = new CasStore();
    const result = await post(store, { sessionId: "round-1", updatedAt: 10, state: { cursor: 0 } });
    assert.deepEqual(result, { sessionId: "round-1", updatedAt: 10, state: { cursor: 0 } });
    assert.ok(store.state.exists, "the row now exists");
  });
});

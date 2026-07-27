// Run: node --import ./src/lib/conjugate/test-hooks.mjs --test \
//        src/lib/history-mutate.test.ts
//
// THE BUG THESE PIN
// =================
// Two overlapping server-side history writes used to clobber each other: each
// loaded the same base, applied its own field, and wrote the WHOLE blob back, so
// the last writer won and the other's field vanished. Claiming a curriculum
// lesson fires /api/claim AND /api/seen at once, so a claim was routinely dropped
// while the seen it raced survived — a durable gap that walked the curriculum
// frontier back toward lesson one.
//
// mutateHistoryWithRetry fixes it with optimistic concurrency: a write lands only
// if the row still carries the token the read saw, and on a miss it re-reads the
// winner and re-applies. These tests drive a faithful compare-and-set store and
// assert that two writes racing the SAME row BOTH survive — the property the
// whole change exists for — plus the no-op and bounded-retry contracts.

import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  mutateHistoryWithRetry,
  type HistoryStore,
  type VersionedRead,
} from "@/lib/history-mutate";
import { applyClaims, applySeen, applySession, emptyHistory } from "@/lib/history-ops";
import type { FactId, HistoryFile, QuizSessionRecord } from "@/types";

const USER = "user-1";
const CLAIM = "kanji:人/meaning" as FactId;
const SEEN = "kanji:一/reading@一" as FactId;

/**
 * An in-memory store that models the real compare-and-set exactly: a write lands
 * only if the row still carries the token the caller read (or, for the first
 * row, only if none exists yet). `onRead` fires ONCE, right after a read snapshots
 * the state and before it returns — the hook a test uses to run a competing writer
 * "in between", which is how a real overlap is reproduced deterministically.
 */
class CasStore implements HistoryStore {
  state: { history: HistoryFile; version: string | null; exists: boolean };
  seq = 0;
  reads = 0;
  writeAttempts = 0;
  conflicts = 0;
  onRead?: () => Promise<void>;

  constructor(seed?: { history: HistoryFile; version: string }) {
    this.state = seed
      ? { history: seed.history, version: seed.version, exists: true }
      : { history: emptyHistory(), version: null, exists: false };
  }

  async read(): Promise<VersionedRead> {
    this.reads++;
    const snapshot: VersionedRead = {
      history: structuredClone(this.state.history),
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

  async write(_userId: string, next: HistoryFile, expected: VersionedRead): Promise<boolean> {
    this.writeAttempts++;
    const wins = expected.exists
      ? this.state.exists && this.state.version === expected.version
      : !this.state.exists;
    if (!wins) {
      this.conflicts++;
      return false;
    }
    this.state = { history: structuredClone(next), version: `v${++this.seq}`, exists: true };
    return true;
  }
}

describe("two overlapping history writes both survive", () => {
  test("a claim racing a seen: last-writer-wins would drop one; CAS keeps both", async () => {
    const store = new CasStore({ history: emptyHistory(), version: "seed" });

    // Between the claim writer's read and its write, the seen writer runs to
    // completion — the exact overlap /api/claim and /api/seen create.
    store.onRead = async () => {
      await mutateHistoryWithRetry(store, USER, (h) => applySeen(h, [SEEN], 2));
    };

    const result = await mutateHistoryWithRetry(store, USER, (h) => applyClaims(h, [CLAIM], 1));

    assert.equal(result.claims?.[CLAIM], 1, "the claim survived");
    assert.equal(result.seen?.[SEEN], 2, "and the seen it raced survived too");
    assert.ok(store.conflicts >= 1, "the claim lost the CAS once and retried");
    assert.equal(store.state.history.claims?.[CLAIM], 1, "the row holds the claim");
    assert.equal(store.state.history.seen?.[SEEN], 2, "and the row holds the seen");
  });

  test("the re-applied op rebuilds on the winner, not on the stale read", async () => {
    // The claim writer's FIRST read predates the seen write; its final result must
    // nonetheless carry the seen, proving the retry re-read rather than reusing
    // the snapshot it started with.
    const store = new CasStore({ history: emptyHistory(), version: "seed" });
    store.onRead = async () => {
      await mutateHistoryWithRetry(store, USER, (h) => applySeen(h, [SEEN], 2));
    };
    await mutateHistoryWithRetry(store, USER, (h) => applyClaims(h, [CLAIM], 1));
    assert.equal(store.reads, 3, "claim read twice (initial + retry); seen read once");
  });
});

describe("contracts preserved", () => {
  test("a no-op op writes nothing and contends for no row", async () => {
    const dup: QuizSessionRecord = { id: "s1", ts: 1, facts: {} } as QuizSessionRecord;
    const seeded: HistoryFile = { sessions: [dup], facts: {} };
    const store = new CasStore({ history: seeded, version: "seed" });

    // applySession returns the SAME reference for an id already stored, so nothing
    // is written — the dedup the outbox relies on, unchanged by the retry wrapper.
    const result = await mutateHistoryWithRetry(store, USER, (h) => applySession(h, dup));

    assert.equal(store.writeAttempts, 0, "a no-op never touches the row");
    assert.equal(result.sessions.length, 1, "and the duplicate was not appended");
  });

  test("the first write on an empty row inserts", async () => {
    const store = new CasStore();
    const result = await mutateHistoryWithRetry(store, USER, (h) => applyClaims(h, [CLAIM], 1));
    assert.equal(result.claims?.[CLAIM], 1);
    assert.ok(store.state.exists, "the row now exists");
  });

  test("sustained contention throws after the bound rather than spinning", async () => {
    // A store that never lets a write land — every attempt is a CAS miss.
    const jammed: HistoryStore = {
      read: async () => ({ history: emptyHistory(), version: "x", exists: true }),
      write: async () => false,
    };
    await assert.rejects(
      () => mutateHistoryWithRetry(jammed, USER, (h) => applyClaims(h, [CLAIM], 1), 3),
      /lost to concurrent writers 3 times/,
    );
  });
});

// The outbox: what happens to a record between "you finished a round" and "the
// server has it". Every property here is one that a `.catch(() => {})` did not
// have.

import assert from "node:assert/strict";
import { test } from "node:test";

import {
  acknowledgePending,
  enqueuePending,
  MAX_PENDING,
  PENDING_KEY,
  readPending,
  type RecordStore,
} from "@/lib/pending-records";
import type { QuizSessionRecord } from "@/types";

/** localStorage, in about the amount of detail this module uses. */
function store(initial?: string): RecordStore & { raw(): string | null } {
  const map = new Map<string, string>();
  if (initial !== undefined) map.set(PENDING_KEY, initial);
  return {
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => void map.set(k, v),
    raw: () => map.get(PENDING_KEY) ?? null,
  };
}

/** A store that refuses everything — a full or disabled localStorage. */
const FULL_STORE: RecordStore = {
  getItem: () => null,
  setItem: () => {
    throw new DOMException("QuotaExceededError");
  },
};

function rec(id: string, ts = 1): QuizSessionRecord {
  return {
    id,
    ts,
    mode: "drill",
    redrill: false,
    total: 1,
    forgivingPct: 100,
    strictPct: 100,
    facts: {},
  };
}

test("a queued record survives being read back", () => {
  const s = store();
  enqueuePending(s, rec("a"));
  assert.deepEqual(
    readPending(s).map((r) => r.id),
    ["a"],
  );
});

test("the queue keeps its order — the fold downstream is order-dependent", () => {
  const s = store();
  enqueuePending(s, rec("a", 1));
  enqueuePending(s, rec("b", 2));
  enqueuePending(s, rec("c", 3));
  assert.deepEqual(
    readPending(s).map((r) => r.id),
    ["a", "b", "c"],
  );
});

test("queueing the same record twice leaves one copy", () => {
  // React effects run twice in development, and a commit path that fires on a
  // state change is exactly the shape that fires more than once.
  const s = store();
  enqueuePending(s, rec("a"));
  enqueuePending(s, rec("a"));
  assert.equal(readPending(s).length, 1);
});

test("enqueue re-reads storage, so another tab's record is not lost", () => {
  const s = store();
  enqueuePending(s, rec("mine"));
  // The other tab writes directly, behind our back.
  s.setItem(PENDING_KEY, JSON.stringify([rec("mine"), rec("theirs")]));
  enqueuePending(s, rec("later"));
  assert.deepEqual(
    readPending(s).map((r) => r.id),
    ["mine", "theirs", "later"],
  );
});

test("acknowledging drops that record BY ID and nothing else", () => {
  const s = store();
  enqueuePending(s, rec("a"));
  enqueuePending(s, rec("b"));
  // A record queued by the other tab while ours was in flight.
  s.setItem(PENDING_KEY, JSON.stringify([rec("a"), rec("b"), rec("c")]));

  const left = acknowledgePending(s, "a");
  assert.deepEqual(
    left.map((r) => r.id),
    ["b", "c"],
    "dropping by position would have taken the other tab's work",
  );
});

test("acknowledging something that is not there changes nothing", () => {
  const s = store();
  enqueuePending(s, rec("a"));
  assert.deepEqual(
    acknowledgePending(s, "gone").map((r) => r.id),
    ["a"],
  );
});

test("a record that cannot be stored is reported, not swallowed", () => {
  // The one failure with nowhere to fall back to. It has to be distinguishable
  // from a successful queue, or the app would tell a learner their work is safe
  // when it is nowhere.
  assert.equal(enqueuePending(FULL_STORE, rec("a")), null);
});

test("an unreadable queue reads as empty, unlike history.json", () => {
  // Deliberately the OPPOSITE rule to loadHistory. This is a retry buffer whose
  // contents have already failed to reach the server once; a client that
  // refuses to start because its outbox is malformed could never queue anything
  // again.
  assert.deepEqual(readPending(store("{not json")), []);
  assert.deepEqual(readPending(store('{"nope": 1}')), []);
  assert.deepEqual(readPending(store("")), []);
});

test("the queue is capped, and drops the OLDEST", () => {
  const s = store();
  for (let i = 0; i < MAX_PENDING + 5; i++) enqueuePending(s, rec(`r${i}`, i));
  const ids = readPending(s).map((r) => r.id);
  assert.equal(ids.length, MAX_PENDING);
  assert.equal(ids[0], "r5", "the five oldest went");
  assert.equal(ids[ids.length - 1], `r${MAX_PENDING + 4}`, "the newest stayed");
});

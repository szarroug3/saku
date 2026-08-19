// The signed-out browser store. Every property here is one a signed-out learner
// depends on for their work to survive a click, a refresh, and eventually a
// sign-in.
//
// RUNNING IN PLAIN NODE. local-progress.ts reaches `window.localStorage`
// directly (it is a browser module — pending-records.ts injects its store, but
// this one is the browser-facing layer the whole point of which is to own that
// global). The functions read the global at CALL time, not at import, so the
// test simply installs a fake `window` before each case and can also remove it
// to exercise the SSR / no-storage guard. Nothing here needs the server-only
// stubbing history.test.ts does, because this module has no server-only in its
// graph — only the shared pure ops.

import assert from "node:assert/strict";
import { beforeEach, test } from "node:test";

import {
  clearLocalHistory,
  clearLocalLists,
  hasLocalProgress,
  loadLocalHistory,
  loadLocalLists,
  LOCAL_HISTORY_KEY,
  localAddToList,
  localClaim,
  localDeleteSessions,
  localDropClaim,
  localResetHistory,
  localSaveList,
  localSeen,
  localSession,
} from "@/lib/store/local-progress";
import type { EntryId, FactId, QuizSessionRecord, SavedList } from "@/types";

const fid = (s: string) => s as unknown as FactId;
const eid = (s: string) => s as unknown as EntryId;

/** A localStorage in about the detail this module uses, plus a raw() peek. */
function fakeStorage() {
  const map = new Map<string, string>();
  return {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, String(v)),
    removeItem: (k: string) => void map.delete(k),
    raw: (k: string) => map.get(k) ?? null,
  };
}

let storage: ReturnType<typeof fakeStorage>;

/** Install a fresh fake browser before each test. */
beforeEach(() => {
  storage = fakeStorage();
  (globalThis as { window?: unknown }).window = { localStorage: storage };
});

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

// ---------- reads degrade, never throw ----------

test("an empty browser reads as the day-one shell", () => {
  assert.deepEqual(loadLocalHistory(), {
    sessions: [],
    facts: {},
    claims: {},
    seen: {},
    // normalizeHistory backfills learnedAt on every read (see
    // withBackfilledLearnedAt); on an empty history that is an empty map.
    learnedAt: {},
  });
  assert.deepEqual(loadLocalLists(), []);
});

test("corrupt local data reads as empty — a disposable cache, not durable", () => {
  // The OPPOSITE of history.json's rule (which throws): this is a browser cache
  // that can be safely thrown away and rebuilt, never the copy of record.
  storage.setItem(LOCAL_HISTORY_KEY, "{not json");
  assert.deepEqual(loadLocalHistory().sessions, []);
  storage.setItem(LOCAL_HISTORY_KEY, '"a string, not a history"');
  assert.deepEqual(loadLocalHistory().sessions, []);
});

test("with no window (SSR), reads are empty and writes are no-ops", () => {
  delete (globalThis as { window?: unknown }).window;
  assert.deepEqual(loadLocalHistory().sessions, []);
  // Must not throw even though there is nowhere to write.
  assert.doesNotThrow(() => localClaim([fid("hira-a")], 1_000));
  assert.deepEqual(loadLocalHistory().claims ?? {}, {});
});

// ---------- writes persist through the shared ops ----------

test("localClaim persists and re-reads", () => {
  localClaim([fid("hira-a"), fid("hira-i")], 1_000);
  assert.deepEqual(loadLocalHistory().claims, {
    "hira-a": 1_000,
    "hira-i": 1_000,
  });
});

// SAK-61: "unclaim" — the Library entry page's "mark as not known" action —
// mirrors POST /api/claim with `known: false` into this same local store when
// a signed-out learner is claiming from a browser rather than an account (see
// postClaim's fallback in progress-fetch.ts and localDropClaim's doc comment).
// This is the storage layer the entry page's unclaim button ultimately writes
// through when there is no server session; the equivalent server-side write
// (applyDropClaims) already has its own coverage in history-ops.test.ts, but
// nothing previously exercised this browser twin, so a regression here could
// have shipped a button whose local fallback silently did nothing.
test("localDropClaim reverses a claim already made, in the same store localClaim wrote to", () => {
  localClaim([fid("hira-a"), fid("hira-i")], 1_000);
  assert.deepEqual(loadLocalHistory().claims, {
    "hira-a": 1_000,
    "hira-i": 1_000,
  });

  const after = localDropClaim([fid("hira-a")]);

  // The return value AND a fresh read agree: the claim is gone, not just
  // absent from the value handed back.
  assert.deepEqual(after.claims, { "hira-i": 1_000 });
  assert.deepEqual(loadLocalHistory().claims, { "hira-i": 1_000 });

  // Unclaiming is not a reset: everything else about the fact (and the other
  // still-claimed fact) survives untouched.
  assert.equal(
    Object.prototype.hasOwnProperty.call(loadLocalHistory().claims ?? {}, "hira-a"),
    false,
    "the key itself is deleted, not zeroed — an absent claim and a claim at ts 0 must not read the same",
  );
});

test("localDropClaim on a fact that was never claimed is a harmless no-op", () => {
  localClaim([fid("hira-a")], 1_000);
  const after = localDropClaim([fid("never-claimed")]);
  assert.deepEqual(after.claims, { "hira-a": 1_000 });
});

test("localSeen writes its own key", () => {
  localSeen([fid("hira-sa")], 3_000);
  const h = loadLocalHistory();
  assert.deepEqual(h.seen, { "hira-sa": 3_000 });
  assert.deepEqual(h.claims, {}, "seen is not a claim");
});

test("localSession appends, folds, and dedupes on id across calls", () => {
  localSession(seedSession(1_000, "r1"));
  localSession(seedSession(1_000, "r1")); // a retry — same id
  const h = loadLocalHistory();
  assert.equal(h.sessions.length, 1, "stored once");
  assert.equal(h.facts[fid("hira-a")].seen, 1, "counted once");
});

test("localDeleteSessions removes and rebuilds the aggregate", () => {
  localSession(seedSession(1_000, "a"));
  localSession(seedSession(2_000, "b"));
  const after = localDeleteSessions(["a"], false);
  assert.equal(after.sessions.length, 1);
  assert.equal(after.facts[fid("hira-a")].seen, 1);
});

test("localResetHistory returns the day-one shell and wipes the store", () => {
  localClaim([fid("hira-a")], 1_000);
  localSession(seedSession(1_000, "a"));
  const empty = localResetHistory();
  assert.deepEqual(empty, { sessions: [], facts: {} });
  assert.deepEqual(loadLocalHistory().sessions, []);
  assert.deepEqual(loadLocalHistory().claims ?? {}, {});
});

// ---------- lists ----------

test("localSaveList then localAddToList persists a fixed list and its entries", () => {
  const list: SavedList = {
    kind: "fixed",
    id: "list-1",
    name: "Mine",
    created: 1,
    entries: [eid("kanji:生")],
    origin: "manual",
  };
  localSaveList(list);
  localAddToList("list-1", [eid("kanji:先")]);
  const [saved] = loadLocalLists();
  assert.equal(saved.kind, "fixed");
  assert.deepEqual(
    (saved as Extract<SavedList, { kind: "fixed" }>).entries,
    [eid("kanji:生"), eid("kanji:先")],
  );
});

test("localAddToList refuses a derived list, mirroring the server guard", () => {
  const derived: SavedList = {
    kind: "derived",
    id: "d-1",
    name: "Kanji I miss",
    created: 1,
    query: { subjects: [], types: [], list: null, states: [], text: "", session: null },
    origin: "search",
  };
  localSaveList(derived);
  localAddToList("d-1", [eid("kanji:生")]);
  const [saved] = loadLocalLists();
  assert.equal(saved.kind, "derived", "still a rule, no entries grafted on");
});

// ---------- migration bookkeeping ----------

test("hasLocalProgress is false when empty and true after any write", () => {
  assert.equal(hasLocalProgress(), false);
  localSeen([fid("hira-a")], 1_000);
  assert.equal(hasLocalProgress(), true);
});

test("clearing forgets the local copy so a merge does not re-run forever", () => {
  localClaim([fid("hira-a")], 1_000);
  localSaveList({
    kind: "fixed",
    id: "l",
    name: "x",
    created: 1,
    entries: [],
    origin: "manual",
  });
  assert.equal(hasLocalProgress(), true);
  clearLocalHistory();
  clearLocalLists();
  assert.equal(hasLocalProgress(), false);
});

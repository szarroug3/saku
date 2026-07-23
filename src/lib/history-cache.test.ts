import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";

import {
  applyCached,
  applyRevalidation,
  clearCachedHistory,
  HISTORY_CACHE_PREFIX,
  historyCacheKey,
  INITIAL_HISTORY_STATE,
  outcomeForResponse,
  readCachedHistory,
  seededState,
  writeCachedHistory,
  type HistoryState,
} from "@/lib/history-cache";
import type { HistoryFile } from "@/types";

/** The parts of localStorage this module touches, in memory: get/set/remove plus
 * the length + key(i) pair the prune walks. `store` is exposed so a test can
 * plant a hand-written entry, which is how the tampering cases are set up. */
class FakeStorage {
  store = new Map<string, string>();
  get length() {
    return this.store.size;
  }
  key(i: number) {
    return [...this.store.keys()][i] ?? null;
  }
  getItem(k: string) {
    return this.store.get(k) ?? null;
  }
  setItem(k: string, v: string) {
    this.store.set(k, v);
  }
  removeItem(k: string) {
    this.store.delete(k);
  }
  clear() {
    this.store.clear();
  }
}

let fake: FakeStorage;

beforeEach(() => {
  fake = new FakeStorage();
  (globalThis as { window?: unknown }).window = { localStorage: fake };
});

afterEach(() => {
  delete (globalThis as { window?: unknown }).window;
});

function history(n: number): HistoryFile {
  return {
    sessions: Array.from({ length: n }, (_, i) => ({ id: `s${i}` })) as HistoryFile["sessions"],
    facts: {},
  };
}

describe("history cache storage", () => {
  it("round-trips a history for one account", () => {
    writeCachedHistory("alice", history(2));
    assert.equal(readCachedHistory("alice")?.sessions.length, 2);
  });

  it("normalizes the optional containers so callers can index them", () => {
    writeCachedHistory("alice", { sessions: [], facts: {} });
    const back = readCachedHistory("alice");
    assert.deepEqual(back?.claims, {});
    assert.deepEqual(back?.seen, {});
  });

  it("never hands one account's copy to another", () => {
    writeCachedHistory("alice", history(3));
    assert.equal(readCachedHistory("bob"), null);
  });

  it("drops an envelope whose id disagrees with its key", () => {
    // A key rewritten by hand, or a profile copied between accounts.
    fake.setItem(
      historyCacheKey("bob"),
      JSON.stringify({ userId: "alice", savedAt: 1, history: history(3) }),
    );
    assert.equal(readCachedHistory("bob"), null);
  });

  it("prunes every other account's entry when it writes", () => {
    writeCachedHistory("alice", history(1));
    writeCachedHistory("bob", history(1));
    assert.equal(readCachedHistory("alice"), null);
    assert.equal(readCachedHistory("bob")?.sessions.length, 1);
    const ours = [...fake.store.keys()].filter((k) => k.startsWith(HISTORY_CACHE_PREFIX));
    assert.deepEqual(ours, [historyCacheKey("bob")]);
  });

  it("leaves other namespaces alone", () => {
    fake.setItem("saku-local-history", "{}");
    writeCachedHistory("alice", history(1));
    assert.equal(fake.getItem("saku-local-history"), "{}");
  });

  it("reads unparseable, misshapen, and missing entries as nothing", () => {
    assert.equal(readCachedHistory("alice"), null);
    fake.setItem(historyCacheKey("alice"), "{not json");
    assert.equal(readCachedHistory("alice"), null);
    fake.setItem(
      historyCacheKey("alice"),
      JSON.stringify({ userId: "alice", savedAt: 1, history: { sessions: "nope" } }),
    );
    assert.equal(readCachedHistory("alice"), null);
  });

  it("clears its own account's copy", () => {
    writeCachedHistory("alice", history(1));
    clearCachedHistory("alice");
    assert.equal(readCachedHistory("alice"), null);
  });

  it("degrades to nothing with no storage at all", () => {
    delete (globalThis as { window?: unknown }).window;
    assert.doesNotThrow(() => writeCachedHistory("alice", history(1)));
    assert.equal(readCachedHistory("alice"), null);
  });
});

describe("seeding from the server", () => {
  it("mounts already loaded when the page carried the history", () => {
    const state = seededState(history(3));
    assert.deepEqual([state.loaded, state.source, state.history.sessions.length], [
      true,
      "server",
      3,
    ]);
  });

  it("mounts unloaded with no seed, so the client goes and asks", () => {
    assert.equal(seededState(null), INITIAL_HISTORY_STATE);
    assert.equal(INITIAL_HISTORY_STATE.loaded, false);
  });

  it("treats a seeded empty history as a real answer, not a missing one", () => {
    // Day one. Nothing to show is what the server said, and the screens must be
    // free to say so instead of spinning.
    const state = seededState({ sessions: [], facts: {} });
    assert.equal(state.loaded, true);
    assert.equal(state.source, "server");
  });
});

describe("the response, as an answer", () => {
  const noLocal = () => {
    throw new Error("the local store must not be read for this status");
  };

  it("takes a 200 as the server's word", async () => {
    const out = await outcomeForResponse(
      { ok: true, status: 200, json: async () => history(2) },
      noLocal,
    );
    assert.equal(out.kind, "server");
  });

  it("reads this browser's own progress on a 401", async () => {
    // The signed-out path: writes went to localStorage, so this is where they
    // have to come back from.
    const out = await outcomeForResponse(
      { ok: false, status: 401, json: async () => ({}) },
      () => history(4),
    );
    assert.equal(out.kind, "local");
    assert.equal(out.kind === "local" && out.history.sessions.length, 4);
  });

  it("treats an unreadable history as no answer, and never as empty", async () => {
    const out = await outcomeForResponse(
      { ok: false, status: 503, json: async () => ({}) },
      noLocal,
    );
    assert.equal(out.kind, "unavailable");
  });
});

describe("reconciliation", () => {
  const cached: HistoryState = {
    history: history(1),
    loaded: true,
    source: "cache",
  };

  it("lets the server replace a cached copy outright", () => {
    const next = applyRevalidation(cached, { kind: "server", history: history(5) });
    assert.equal(next.source, "server");
    assert.equal(next.history.sessions.length, 5);
  });

  it("lets the server win even when it has less than the cache", () => {
    // A delete on another device. Fewer sessions is an ANSWER, not a loss, and
    // merging the two would resurrect what the learner removed.
    const next = applyRevalidation(cached, { kind: "server", history: history(0) });
    assert.equal(next.history.sessions.length, 0);
  });

  it("takes the local store's answer for a signed-out learner", () => {
    const next = applyRevalidation(INITIAL_HISTORY_STATE, {
      kind: "local",
      history: history(2),
    });
    assert.deepEqual([next.source, next.loaded, next.history.sessions.length], [
      "local",
      true,
      2,
    ]);
  });

  it("keeps what is on screen when the server cannot answer", () => {
    const next = applyRevalidation(cached, { kind: "unavailable" });
    assert.equal(next.history, cached.history);
    assert.equal(next.source, "cache");
  });

  it("stops waiting even when the server cannot answer", () => {
    const next = applyRevalidation(INITIAL_HISTORY_STATE, { kind: "unavailable" });
    assert.equal(next.loaded, true);
    assert.equal(next.source, "empty");
  });

  it("lets a cached copy fill an empty screen", () => {
    const next = applyCached(INITIAL_HISTORY_STATE, history(4));
    assert.deepEqual([next.source, next.loaded, next.history.sessions.length], [
      "cache",
      true,
      4,
    ]);
  });

  it("never lets a late cache read overwrite a real answer", () => {
    const served: HistoryState = { history: history(9), loaded: true, source: "server" };
    assert.equal(applyCached(served, history(1)), served);
    const local: HistoryState = { history: history(2), loaded: true, source: "local" };
    assert.equal(applyCached(local, history(1)), local);
  });

  it("does nothing with no cached copy", () => {
    assert.equal(applyCached(INITIAL_HISTORY_STATE, null), INITIAL_HISTORY_STATE);
  });
});

import assert from "node:assert/strict";
import { test } from "node:test";

import { legacyKey, migratedGet, type MigratableStore } from "./storage-migrate";

/** A minimal in-memory Storage stand-in that records writes and removals. */
function fakeStore(seed: Record<string, string> = {}): MigratableStore & {
  data: Record<string, string>;
  removeItem: (k: string) => void;
} {
  const data = { ...seed };
  return {
    data,
    getItem: (k) => (k in data ? data[k] : null),
    setItem: (k, v) => {
      data[k] = v;
    },
    removeItem: (k) => {
      delete data[k];
    },
  };
}

test("migratedGet: new key present wins and a stale old key is retired", () => {
  const store = fakeStore({ "saku-theme": "kiri", "kanaquiz-theme": "aizome" });
  assert.equal(migratedGet(store, "saku-theme", "kanaquiz-theme"), "kiri");
  // The old value must NOT overwrite the new one.
  assert.equal(store.data["saku-theme"], "kiri");
  // And the legacy key is cleaned up so it can't resurface later.
  assert.equal("kanaquiz-theme" in store.data, false);
});

test("migratedGet: new absent + old present MOVES it forward (copy then delete)", () => {
  const store = fakeStore({ "kanaquiz-theme": "aizome" });
  assert.equal(migratedGet(store, "saku-theme", "kanaquiz-theme"), "aizome");
  // The value lives under the new key…
  assert.equal(store.data["saku-theme"], "aizome");
  // …and the old key is gone, so a later removal of the new key cannot re-migrate.
  assert.equal("kanaquiz-theme" in store.data, false);
});

test("migratedGet: a removed new key does NOT resurrect a moved legacy value", () => {
  // The bug this move-semantics guards against: close a section, it must stay shut.
  const store = fakeStore({ "kanaquiz-lesson-writing": "1" });
  assert.equal(migratedGet(store, "saku-lesson-writing", "kanaquiz-lesson-writing"), "1");
  store.removeItem("saku-lesson-writing"); // the section is closed
  assert.equal(migratedGet(store, "saku-lesson-writing", "kanaquiz-lesson-writing"), null);
});

test("migratedGet: without removeItem the move degrades to a copy, no throw", () => {
  const data: Record<string, string> = { "kanaquiz-x": "v" };
  const store: MigratableStore = {
    getItem: (k) => (k in data ? data[k] : null),
    setItem: (k, val) => {
      data[k] = val;
    },
    // no removeItem
  };
  assert.equal(migratedGet(store, "saku-x", "kanaquiz-x"), "v");
  assert.equal(data["saku-x"], "v");
});

test("migratedGet: both absent returns null and writes nothing", () => {
  const store = fakeStore();
  assert.equal(migratedGet(store, "saku-theme", "kanaquiz-theme"), null);
  assert.equal("saku-theme" in store.data, false);
});

test("migratedGet: an empty-string value under the old key still migrates", () => {
  // "" is a real stored value (getItem returns "" not null), so it must migrate.
  const store = fakeStore({ "kanaquiz-cfg": "" });
  assert.equal(migratedGet(store, "saku-cfg", "kanaquiz-cfg"), "");
  assert.equal(store.data["saku-cfg"], "");
});

test("migratedGet: a throwing setItem still returns the legacy value", () => {
  const store: MigratableStore = {
    getItem: (k) => (k === "kanaquiz-x" ? "v" : null),
    setItem: () => {
      throw new Error("quota");
    },
  };
  assert.equal(migratedGet(store, "saku-x", "kanaquiz-x"), "v");
});

test("migratedGet: a null/undefined store is null, never a throw", () => {
  assert.equal(migratedGet(null, "saku-x", "kanaquiz-x"), null);
  assert.equal(migratedGet(undefined, "saku-x", "kanaquiz-x"), null);
});

test("legacyKey: rewrites the saku- prefix to kanaquiz-", () => {
  assert.equal(legacyKey("saku-theme"), "kanaquiz-theme");
  assert.equal(legacyKey("saku-intro-track-kanji"), "kanaquiz-intro-track-kanji");
  // A key without the saku- prefix is returned unchanged.
  assert.equal(legacyKey("something-else"), "something-else");
});

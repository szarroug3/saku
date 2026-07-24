import assert from "node:assert/strict";
import { test } from "node:test";

import { legacyKey, migratedGet, type MigratableStore } from "./storage-migrate";

/** A minimal in-memory Storage stand-in that records writes. */
function fakeStore(seed: Record<string, string> = {}): MigratableStore & {
  data: Record<string, string>;
} {
  const data = { ...seed };
  return {
    data,
    getItem: (k) => (k in data ? data[k] : null),
    setItem: (k, v) => {
      data[k] = v;
    },
  };
}

test("migratedGet: new key present wins and the old key is ignored", () => {
  const store = fakeStore({ "saku-theme": "kiri", "kanaquiz-theme": "aizome" });
  assert.equal(migratedGet(store, "saku-theme", "kanaquiz-theme"), "kiri");
  // The old value must NOT overwrite the new one.
  assert.equal(store.data["saku-theme"], "kiri");
});

test("migratedGet: new absent + old present migrates forward and returns old", () => {
  const store = fakeStore({ "kanaquiz-theme": "aizome" });
  assert.equal(migratedGet(store, "saku-theme", "kanaquiz-theme"), "aizome");
  // The value was copied under the new key.
  assert.equal(store.data["saku-theme"], "aizome");
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

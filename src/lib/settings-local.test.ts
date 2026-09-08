import assert from "node:assert/strict";
import { test } from "node:test";

import {
  CFG_KEY,
  PRACTICE_MISSES_KEY,
  PRACTICE_SAVED_KEY,
} from "./settings-keys";
import {
  applyServerSettings,
  readLocalSettings,
  type SettingsStore,
} from "./settings-local";

/** An in-memory Storage stand-in with the three methods the map needs. */
function fakeStore(seed: Record<string, string> = {}): SettingsStore & {
  data: Record<string, string>;
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

test("readLocalSettings: gathers only the keys that are set", () => {
  const store = fakeStore({ [CFG_KEY]: JSON.stringify({ mode: "drill" }) });
  assert.deepEqual(readLocalSettings(store), { cfg: { mode: "drill" } });
});

test("readLocalSettings: an empty store reads as empty settings", () => {
  assert.deepEqual(readLocalSettings(fakeStore()), {});
  assert.deepEqual(readLocalSettings(null), {});
});

test("readLocalSettings: a corrupt cfg is not sent up", () => {
  assert.deepEqual(readLocalSettings(fakeStore({ [CFG_KEY]: "{not json" })), {});
});

test("applyServerSettings: writes present fields into the individual keys", () => {
  const store = fakeStore();
  applyServerSettings(store, { cfg: { mode: "drill" } as never });
  assert.equal(store.data[CFG_KEY], JSON.stringify({ mode: "drill" }));
});

test("applyServerSettings: a field the server did not send leaves the local key alone", () => {
  const store = fakeStore({ [CFG_KEY]: JSON.stringify({ mode: "drill" }) });
  applyServerSettings(store, { practice: { misses: { a: 1 } } });
  assert.equal(store.data[CFG_KEY], JSON.stringify({ mode: "drill" }));
  assert.equal(store.data[PRACTICE_MISSES_KEY], JSON.stringify({ a: 1 }));
});

test("round trip: applyServerSettings then readLocalSettings recovers the blob", () => {
  const store = fakeStore();
  const settings = {
    cfg: { mode: "drill" } as never,
    practice: { saved: [{ name: "Tonight", recipe: {} }], misses: { "kana:あ/reading": 2 } },
  };
  applyServerSettings(store, settings);
  assert.deepEqual(readLocalSettings(store), settings);
});

test("practice (SAK-342): the saved recipes and misses ride the blob both ways", () => {
  const store = fakeStore();
  const practice = { saved: [{ name: "Tonight", recipe: { collections: ["kana"] } }], misses: { "kana:あ/reading": 2 } };
  applyServerSettings(store, { practice });
  assert.equal(store.data[PRACTICE_SAVED_KEY], JSON.stringify(practice.saved));
  assert.equal(store.data[PRACTICE_MISSES_KEY], JSON.stringify(practice.misses));
  assert.deepEqual(readLocalSettings(store).practice, practice);
  // a blob without practice leaves the keys alone
  applyServerSettings(store, { cfg: { mode: "drill" } as never });
  assert.equal(store.data[PRACTICE_SAVED_KEY], JSON.stringify(practice.saved));
  // an empty browser has no practice field to send up
  assert.equal(readLocalSettings(fakeStore()).practice, undefined);
});

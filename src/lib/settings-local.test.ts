import assert from "node:assert/strict";
import { test } from "node:test";

import {
  CFG_KEY,
  PAGES_SEEN_KEY,
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
  applyServerSettings(store, { practice: { saved: [{ name: "Tonight", recipe: {} }] } });
  assert.equal(store.data[CFG_KEY], JSON.stringify({ mode: "drill" }));
  assert.equal(store.data[PRACTICE_SAVED_KEY], JSON.stringify([{ name: "Tonight", recipe: {} }]));
});

test("round trip: applyServerSettings then readLocalSettings recovers the blob", () => {
  const store = fakeStore();
  const settings = {
    cfg: { mode: "drill" } as never,
    practice: { saved: [{ name: "Tonight", recipe: {} }] },
  };
  applyServerSettings(store, settings);
  assert.deepEqual(readLocalSettings(store), settings);
});

// SAK-342, less its second half: practice used to keep its own count of what
// had been missed beside the recipes, and it rode the blob the same way. That
// store is gone with SAK-441, which records a practice run like any quiz.
test("practice (SAK-342): the saved recipes ride the blob both ways", () => {
  const store = fakeStore();
  const practice = { saved: [{ name: "Tonight", recipe: { collections: ["kana"] } }] };
  applyServerSettings(store, { practice });
  assert.equal(store.data[PRACTICE_SAVED_KEY], JSON.stringify(practice.saved));
  assert.deepEqual(readLocalSettings(store).practice, practice);
  // a blob without practice leaves the keys alone
  applyServerSettings(store, { cfg: { mode: "drill" } as never });
  assert.equal(store.data[PRACTICE_SAVED_KEY], JSON.stringify(practice.saved));
  // an empty browser has no practice field to send up
  assert.equal(readLocalSettings(fakeStore()).practice, undefined);
});

// SAK-467: the reference pages a lesson has shown, in the same blob and by the
// same rules as Practice's recipes.
test("pages seen (SAK-467): the shown reference pages ride the blob both ways", () => {
  const store = fakeStore();
  const pagesSeen = ["page:term:kana", "page:term:hiragana"];
  applyServerSettings(store, { pagesSeen });
  assert.equal(store.data[PAGES_SEEN_KEY], JSON.stringify(pagesSeen));
  assert.deepEqual(readLocalSettings(store).pagesSeen, pagesSeen);
  // a blob without the field leaves the key alone
  applyServerSettings(store, { cfg: { mode: "drill" } as never });
  assert.equal(store.data[PAGES_SEEN_KEY], JSON.stringify(pagesSeen));
  // an empty browser has nothing to send up, and anything that is not a list
  // of names reads as nothing rather than throwing
  assert.equal(readLocalSettings(fakeStore()).pagesSeen, undefined);
  assert.deepEqual(readLocalSettings(fakeStore({ [PAGES_SEEN_KEY]: JSON.stringify(["a", 3, null]) })).pagesSeen, ["a"]);
});

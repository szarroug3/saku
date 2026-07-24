import assert from "node:assert/strict";
import { test } from "node:test";

import {
  ACCENTS_KEY,
  CFG_KEY,
  CLAIM_HINT_DISMISSED,
  CLAIM_HINT_KEY,
  introShownKey,
  INTRO_SHOWN,
  LATENCY_KEY,
  LESSON_OPEN,
  LESSON_WRITING_KEY,
  OLD_CFG_KEY,
  OLD_THEME_KEY,
  THEME_KEY,
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
  const store = fakeStore({
    [THEME_KEY]: "aizome",
    [CLAIM_HINT_KEY]: CLAIM_HINT_DISMISSED,
    [LESSON_WRITING_KEY]: LESSON_OPEN,
  });
  const out = readLocalSettings(store);
  assert.deepEqual(out, {
    theme: "aizome",
    claimHintDismissed: true,
    lessonWriting: true,
  });
});

test("readLocalSettings: an empty store reads as empty settings", () => {
  assert.deepEqual(readLocalSettings(fakeStore()), {});
  assert.deepEqual(readLocalSettings(null), {});
});

test("readLocalSettings: parses structured cfg / accents / latency, drops junk", () => {
  const store = fakeStore({
    [CFG_KEY]: JSON.stringify({ mode: "drill" }),
    [ACCENTS_KEY]: JSON.stringify({ kiri: "magenta" }),
    [LATENCY_KEY]: "not json",
  });
  const out = readLocalSettings(store);
  assert.deepEqual(out.cfg, { mode: "drill" });
  assert.deepEqual(out.accents, { kiri: "magenta" });
  // Unparseable latency is simply absent, not a throw.
  assert.equal("latency" in out, false);
});

test("readLocalSettings: migrates a legacy kanaquiz- value forward on read", () => {
  const store = fakeStore({ [OLD_THEME_KEY]: "graphite" });
  const out = readLocalSettings(store);
  assert.equal(out.theme, "graphite");
  // The value was copied under the new key as a side effect of the read.
  assert.equal(store.data[THEME_KEY], "graphite");
});

test("readLocalSettings: does not send a legacy cfg default over the new key when both differ", () => {
  // New key present wins over the old one (migratedGet contract).
  const store = fakeStore({
    [CFG_KEY]: JSON.stringify({ mode: "new" }),
    [OLD_CFG_KEY]: JSON.stringify({ mode: "old" }),
  });
  assert.deepEqual(readLocalSettings(store).cfg, { mode: "new" });
});

test("applyServerSettings: writes present fields into the individual keys", () => {
  const store = fakeStore();
  applyServerSettings(store, {
    theme: "kiri",
    claimHintDismissed: true,
    lessonWriting: false,
    introShown: ["track-kanji"],
  });
  assert.equal(store.data[THEME_KEY], "kiri");
  assert.equal(store.data[CLAIM_HINT_KEY], CLAIM_HINT_DISMISSED);
  // false clears the flag rather than storing a falsy sentinel.
  assert.equal(LESSON_WRITING_KEY in store.data, false);
  assert.equal(store.data[introShownKey("track-kanji")], INTRO_SHOWN);
});

test("applyServerSettings: a field the server did not send leaves the local key alone", () => {
  const store = fakeStore({ [THEME_KEY]: "aizome" });
  applyServerSettings(store, { appearance: "dark" });
  // theme untouched, appearance added.
  assert.equal(store.data[THEME_KEY], "aizome");
  assert.equal(store.data["saku-appearance"], "dark");
});

test("round trip: applyServerSettings then readLocalSettings recovers the blob", () => {
  const store = fakeStore();
  const settings = {
    theme: "momentum",
    appearance: "light",
    accents: { kiri: "cyan" },
    claimHintDismissed: true,
    lessonReadings: true,
    introShown: ["track-word"],
    latency: { typed: [120, 140] },
  };
  applyServerSettings(store, settings);
  const back = readLocalSettings(store);
  assert.deepEqual(back, settings);
});

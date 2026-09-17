import assert from "node:assert/strict";
import { test } from "node:test";

import {
  isEmptySettings,
  mergeSettings,
  normalizeSettings,
  reconcileSettings,
} from "./settings-merge";
import type { QuizConfig } from "@/types/sky";
import type { SettingsFile } from "@/types/store";

/** A config stands in for "the whole value the client owns"; the merge never
 * looks inside it, so a one-field object is config enough for these. */
const cfg = (mode: string) => ({ mode }) as unknown as QuizConfig;

test("normalizeSettings: a non-object reads as empty", () => {
  assert.deepEqual(normalizeSettings(null), {});
  assert.deepEqual(normalizeSettings("nope"), {});
  assert.deepEqual(normalizeSettings([1, 2]), {});
});

test("normalizeSettings: keeps known fields, drops unknown ones", () => {
  // `theme` is one of the seven the old app stored (SAK-374): a row written
  // before that reads as the two fields that are left.
  const out = normalizeSettings({ cfg: cfg("drill"), bogus: 1, theme: "kiri" });
  assert.deepEqual(out, { cfg: cfg("drill") });
});

test("mergeSettings: a present field replaces, an absent field is untouched", () => {
  const prev: SettingsFile = { cfg: cfg("drill"), practice: { saved: [{ name: "Kanji drill", recipe: {} }] } };
  const next = mergeSettings(prev, { cfg: cfg("pairs") });
  assert.deepEqual(next, { cfg: cfg("pairs"), practice: { saved: [{ name: "Kanji drill", recipe: {} }] } });
});

test("mergeSettings: undefined in the patch means 'not sent', not 'clear'", () => {
  const prev: SettingsFile = { cfg: cfg("drill"), practice: { saved: [] } };
  const next = mergeSettings(prev, { cfg: undefined, practice: { saved: [{ name: "Kanji drill", recipe: {} }] } });
  // cfg survives (skipped), the recipes are explicitly replaced.
  assert.deepEqual(next.cfg, cfg("drill"));
  assert.equal(next.practice?.saved?.length, 1);
});

test("reconcileSettings: server value wins over local cache", () => {
  const local: SettingsFile = { cfg: cfg("drill"), practice: { saved: [] } };
  const server: SettingsFile = { cfg: cfg("pairs") };
  const merged = reconcileSettings(local, server);
  // Server's cfg wins; local fields the server never spoke to survive.
  assert.deepEqual(merged.cfg, cfg("pairs"));
  assert.deepEqual(merged.practice?.saved, []);
});

test("reconcileSettings: an empty server leaves the local cache intact", () => {
  const local: SettingsFile = { cfg: cfg("drill") };
  const merged = reconcileSettings(local, {});
  assert.deepEqual(merged, local);
});

test("isEmptySettings: true only when every field is absent", () => {
  assert.equal(isEmptySettings({}), true);
  assert.equal(isEmptySettings({ cfg: cfg("drill") }), false);
  // A field set to an empty value still counts as set.
  assert.equal(isEmptySettings({ practice: {} }), false);
});

// Practice used to carry two halves, the saved recipes and its own count of
// what had been missed, and they were merged one level deeper so that a laptop
// saving a recipe did not carry its stale misses over a phone's (SAK-377). A
// practice run is recorded now (SAK-441), so the misses are the history's, and
// practice is one value the last writer owns, like every other field.
test("practice: the saved recipes are replaced whole, and a device can empty its own", () => {
  const server: SettingsFile = { practice: { saved: [{ name: "Kanji drill", recipe: {} }] } };
  assert.deepEqual(mergeSettings(server, { practice: { saved: [] } }).practice, { saved: [] });
  const renamed = mergeSettings(server, { practice: { saved: [{ name: "Evening drill", recipe: {} }] } });
  assert.deepEqual(renamed.practice?.saved?.map((d) => d.name), ["Evening drill"]);
});

test("practice: a write to another field leaves the recipes alone", () => {
  const server: SettingsFile = { cfg: cfg("drill"), practice: { saved: [{ name: "Kanji drill", recipe: {} }] } };
  const after = mergeSettings(server, { cfg: cfg("pairs") });
  assert.deepEqual(after.cfg, cfg("pairs"));
  assert.equal(after.practice?.saved?.length, 1);
});

test("practice: nothing carries a misses half any more", () => {
  const server = mergeSettings({}, { practice: { saved: [] } });
  assert.deepEqual(Object.keys(server.practice ?? {}), ["saved"]);
});

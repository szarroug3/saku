import assert from "node:assert/strict";
import { test } from "node:test";

import {
  isEmptySettings,
  mergeSettings,
  normalizeSettings,
  reconcileSettings,
} from "./settings-merge";
import type { QuizConfig, SettingsFile } from "@/types";

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
  const prev: SettingsFile = { cfg: cfg("drill"), practice: { misses: { a: 1 } } };
  const next = mergeSettings(prev, { cfg: cfg("pairs") });
  assert.deepEqual(next, { cfg: cfg("pairs"), practice: { misses: { a: 1 } } });
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

test("practice halves: a laptop saving a recipe does not carry its stale misses over a phone's", () => {
  // the phone recorded a miss; this laptop last synced before that
  const server: SettingsFile = { practice: { saved: [], misses: { "kana:あ/reading": 3 } } };
  // the laptop saves a recipe, and says only that
  const after = mergeSettings(server, { practice: { saved: [{ name: "Kanji drill", recipe: {} }] } });
  assert.deepEqual(after.practice?.misses, { "kana:あ/reading": 3 });
  assert.equal(after.practice?.saved?.length, 1);
});

test("practice halves: a phone recording a miss does not drop the recipes saved elsewhere", () => {
  const server: SettingsFile = { practice: { saved: [{ name: "Kanji drill", recipe: {} }], misses: {} } };
  const after = mergeSettings(server, { practice: { misses: { "kana:い/reading": 1 } } });
  assert.equal(after.practice?.saved?.length, 1);
  assert.deepEqual(after.practice?.misses, { "kana:い/reading": 1 });
});

test("practice halves: takes the larger count per card, since a miss only ever happens again", () => {
  const server: SettingsFile = { practice: { misses: { a: 5, b: 1 } } };
  const after = mergeSettings(server, { practice: { misses: { a: 2, b: 4, c: 1 } } });
  assert.deepEqual(after.practice?.misses, { a: 5, b: 4, c: 1 });
});

test("practice halves: ignores a count that is not a number, rather than storing it", () => {
  const server: SettingsFile = { practice: { misses: { a: 2 } } };
  const after = mergeSettings(server, { practice: { misses: { a: "many", b: NaN } as never } });
  assert.deepEqual(after.practice?.misses, { a: 2 });
});

test("practice halves: still lets a device empty its own saved recipes", () => {
  const server: SettingsFile = { practice: { saved: [{ name: "Kanji drill", recipe: {} }], misses: { a: 1 } } };
  const after = mergeSettings(server, { practice: { saved: [] } });
  assert.deepEqual(after.practice?.saved, []);
  assert.deepEqual(after.practice?.misses, { a: 1 });
});

test("practice halves: leaves every other field replaced whole, which is right for a single choice", () => {
  const server: SettingsFile = { cfg: cfg("drill"), practice: { misses: { a: 1 } } };
  const after = mergeSettings(server, { cfg: cfg("pairs") });
  assert.deepEqual(after.cfg, cfg("pairs"));
  assert.deepEqual(after.practice?.misses, { a: 1 });
});

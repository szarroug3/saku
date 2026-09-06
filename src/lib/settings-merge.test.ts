import assert from "node:assert/strict";
import { test } from "node:test";

import {
  isEmptySettings,
  mergeSettings,
  normalizeSettings,
  reconcileSettings,
} from "./settings-merge";
import type { SettingsFile } from "@/types";

test("normalizeSettings: a non-object reads as empty", () => {
  assert.deepEqual(normalizeSettings(null), {});
  assert.deepEqual(normalizeSettings("nope"), {});
  assert.deepEqual(normalizeSettings([1, 2]), {});
});

test("normalizeSettings: keeps known fields, drops unknown ones", () => {
  const out = normalizeSettings({ theme: "kiri", bogus: 1, introShown: ["a"] });
  assert.deepEqual(out, { theme: "kiri", introShown: ["a"] });
});

test("mergeSettings: a present field replaces, an absent field is untouched", () => {
  const prev = { theme: "aizome", appearance: "dark", claimHintDismissed: true };
  const next = mergeSettings(prev, { theme: "kiri" });
  assert.deepEqual(next, {
    theme: "kiri",
    appearance: "dark",
    claimHintDismissed: true,
  });
});

test("mergeSettings: undefined in the patch means 'not sent', not 'clear'", () => {
  const prev = { theme: "kiri", claimHintDismissed: true };
  const next = mergeSettings(prev, { theme: undefined, claimHintDismissed: false });
  // theme survives (skipped), the boolean is explicitly set to false.
  assert.deepEqual(next, { theme: "kiri", claimHintDismissed: false });
});

test("mergeSettings: [] and false are real values that replace", () => {
  const prev = { introShown: ["track-kanji"], lessonWriting: true };
  const next = mergeSettings(prev, { introShown: [], lessonWriting: false });
  assert.deepEqual(next, { introShown: [], lessonWriting: false });
});

test("reconcileSettings: server value wins over local cache", () => {
  const local = { theme: "aizome", appearance: "light", cfg: { a: 1 } as never };
  const server = { theme: "kiri" };
  const merged = reconcileSettings(local, server);
  // Server's theme wins; local fields the server never spoke to survive.
  assert.equal(merged.theme, "kiri");
  assert.equal(merged.appearance, "light");
  assert.deepEqual(merged.cfg, { a: 1 });
});

test("reconcileSettings: an empty server leaves the local cache intact", () => {
  const local = { theme: "aizome" };
  const merged = reconcileSettings(local, {});
  assert.deepEqual(merged, local);
});

test("isEmptySettings: true only when every field is absent", () => {
  assert.equal(isEmptySettings({}), true);
  assert.equal(isEmptySettings({ theme: "kiri" }), false);
  assert.equal(isEmptySettings({ introShown: [] }), false);
  // A field explicitly set to false still counts as set.
  assert.equal(isEmptySettings({ claimHintDismissed: false }), false);
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
  const server: SettingsFile = { theme: "dark" as never, practice: { misses: { a: 1 } } };
  const after = mergeSettings(server, { theme: "light" as never });
  assert.equal(after.theme, "light" as never);
  assert.deepEqual(after.practice?.misses, { a: 1 });
});

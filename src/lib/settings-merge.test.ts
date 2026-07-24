import assert from "node:assert/strict";
import { test } from "node:test";

import {
  isEmptySettings,
  mergeSettings,
  normalizeSettings,
  reconcileSettings,
} from "./settings-merge";

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
  const local = { theme: "aizome", latency: { typed: [100] } };
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

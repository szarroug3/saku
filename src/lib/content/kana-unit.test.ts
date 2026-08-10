// Run: node --import ./src/lib/conjugate/test-hooks.mjs --test src/lib/content/kana-unit.test.ts

import assert from "node:assert/strict";
import test from "node:test";

import { kanaItems, kanaUnitsOf } from "./kana-unit.ts";

test("kanaItems — every kana builds as a ContentItem", () => {
  const items = kanaItems();
  assert.ok(items.length >= 46, "at least the base hiragana");
  assert.ok(items.every((i) => i.kind === "kana"));
});

test("kanaUnitsOf — a kana teaches its glyph → sound, no meaning", () => {
  const a = kanaItems().find((i) => i.glyph === "あ")!;
  const [unit] = kanaUnitsOf(a);
  assert.equal(unit.kind, "pronunciation");
  assert.equal(unit.glyph, "あ");
  assert.equal(unit.reading, "a", "the sound is the reading");
  assert.deepEqual(unit.meanings, [], "a kana carries no meaning");
  assert.equal(unit.cost, 1);
  assert.ok(unit.facts.length >= 1);
});

// Run: node --import ./src/lib/conjugate/test-hooks.mjs --test src/lib/content/teach-unit.test.ts

import assert from "node:assert/strict";
import test from "node:test";

import { teachUnitsOf } from "./teach-unit.ts";
import { buildGlyphItem } from "./build-item.ts";

test("teachUnitsOf — 三 is ONE unit: three, read さん, grouping all its facts", () => {
  const item = buildGlyphItem("三")!;
  const units = teachUnitsOf(item);
  assert.equal(units.length, 1, "kanji-three + word-three + さん collapse to one meaning");
  assert.equal(units[0].label, "three");
  assert.equal(units[0].reading, "さん");
  assert.equal(units[0].facts.length, item.facts.length, "the unit groups every fact");
});

test("teachUnitsOf — 耳 is one unit: ear, read みみ", () => {
  const units = teachUnitsOf(buildGlyphItem("耳")!);
  assert.equal(units.length, 1);
  assert.equal(units[0].label, "ear");
  assert.equal(units[0].reading, "みみ");
});

test("teachUnitsOf — 人 splits into distinct meanings; person carries ひと, man is its own", () => {
  const units = teachUnitsOf(buildGlyphItem("人")!);
  const person = units.find((u) => u.label === "person");
  const man = units.find((u) => u.label === "man");
  assert.ok(person, "a person unit exists");
  assert.equal(person!.reading, "ひと", "person is read ひと");
  assert.ok(man, "man (the radical sense) is its own unit until the registry merges it");
  assert.equal(man!.reading, null, "the radical meaning carries no reading");
});

test("teachUnitsOf — every fact lands in exactly one unit (nothing dropped or duplicated)", () => {
  const item = buildGlyphItem("人")!;
  const grouped = teachUnitsOf(item).flatMap((u) => u.facts);
  assert.equal(grouped.length, item.facts.length, "same count");
  assert.deepEqual(new Set(grouped), new Set(item.facts.map((f) => f.id)), "same set");
});

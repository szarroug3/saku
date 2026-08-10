// Run: node --import ./src/lib/conjugate/test-hooks.mjs --test src/lib/content/teach-unit.test.ts

import assert from "node:assert/strict";
import test from "node:test";

import { teachUnitsOf, unitCost } from "./teach-unit.ts";
import { buildGlyphItem } from "./build-item.ts";

test("teachUnitsOf — 三 is ONE unit: pronunciation さん, meaning three", () => {
  const units = teachUnitsOf(buildGlyphItem("三")!);
  assert.equal(units.length, 1);
  assert.equal(units[0].reading, "さん");
  assert.deepEqual(units[0].meanings.map((m) => m.label), ["three"]);
  assert.equal(unitCost(units[0]), 1, "one pronunciation→meaning fact");
});

test("teachUnitsOf — 人 splits by PRONUNCIATION: ひと / じん / にん, each its own unit", () => {
  const units = teachUnitsOf(buildGlyphItem("人")!);
  const readings = units.map((u) => u.reading);
  assert.ok(readings.includes("ひと"), "person unit read ひと");
  assert.ok(readings.includes("じん") && readings.includes("にん"), "the other readings are their own units");
  // The core meanings (kanji person, radical man) attach to the primary reading ひと.
  const hito = units.find((u) => u.reading === "ひと")!;
  assert.ok(hito.meanings.some((m) => m.label === "person"), "ひと carries person");
});

test("unitCost — counts meanings, not the reading; each の unit ≈ its senses", () => {
  const hito = teachUnitsOf(buildGlyphItem("人")!).find((u) => u.reading === "ひと")!;
  // stub registry: person (word+kanji) + man (radical) → 2; registry merges man≈person → 1.
  assert.ok(unitCost(hito) >= 1, "the primary unit costs its distinct meanings");
  assert.equal(unitCost(hito), hito.meanings.length);
});

test("teachUnitsOf — every fact lands in exactly one unit (nothing dropped)", () => {
  const item = buildGlyphItem("人")!;
  const grouped = teachUnitsOf(item).flatMap((u) => u.facts);
  assert.equal(grouped.length, item.facts.length);
  assert.deepEqual(new Set(grouped), new Set(item.facts.map((f) => f.id)));
});

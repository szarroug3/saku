// Run: node --import ./src/lib/conjugate/test-hooks.mjs --test src/lib/content/grammar-unit.test.ts

import assert from "node:assert/strict";
import test from "node:test";

import { grammarItems, grammarUnitsOf } from "./grammar-unit.ts";

test("grammarItems — a non-empty list of grammar items builds", () => {
  const items = grammarItems();
  assert.ok(items.length > 0, "enumerates grammar patterns");
  assert.ok(
    items.every((i) => i.kind === "grammar"),
    "every item is a grammar item",
  );
});

test("grammarUnitsOf — the て-sequence pattern yields a populated production unit", () => {
  const te = grammarItems().find((i) => String(i.entry) === "grammar:te-sequence");
  assert.ok(te, "the て-sequence pattern is present");
  const [unit] = grammarUnitsOf(te!);
  assert.equal(unit.kind, "grammar-production");
  assert.equal(unit.pattern, te!.glyph, "pattern is the item glyph");
  assert.ok(unit.summary.length > 0, "summary comes from the meaning fact gloss");
  assert.ok(unit.facts.length > 0, "carries the pattern's fact ids");
  assert.ok(unit.cost >= 1, "cost is at least one meaning");
});

test("grammarUnitsOf — a two-sense pattern costs its distinct meanings", () => {
  const units = grammarItems().map((i) => grammarUnitsOf(i)[0]);
  assert.ok(
    units.some((u) => u.cost >= 2),
    "at least one pattern has two distinct meanings",
  );
});

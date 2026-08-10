// Run: node --import ./src/lib/conjugate/test-hooks.mjs --test src/lib/content/verb-pair-unit.test.ts

import assert from "node:assert/strict";
import test from "node:test";

import { transitivityItems, verbPairUnitsOf } from "./verb-pair-unit.ts";

test("transitivityItems — a non-empty list of pair items builds", () => {
  const items = transitivityItems();
  assert.ok(items.length > 0, "enumerates verb pairs");
  assert.ok(
    items.every((i) => i.kind === "transitivity"),
    "every item is a transitivity item",
  );
});

test("verbPairUnitsOf — the 開く/開ける pair yields a populated unit, intransitive first", () => {
  const pair = transitivityItems().find(
    (i) => String(i.entry) === "transitivity:開く/開ける",
  );
  assert.ok(pair, "the 開く/開ける pair is present");
  const [unit] = verbPairUnitsOf(pair!);
  assert.equal(unit.kind, "verb-pair");
  assert.equal(unit.intransitive, "開く", "happens side is the intransitive");
  assert.equal(unit.transitive, "開ける", "doIt side is the transitive");
  assert.equal(unit.base, "開", "base is the kanji both verbs share");
  assert.equal(unit.facts.length, 2, "both sides of the pair");
  assert.equal(unit.cost, 2, "both verbs learned");
});

test("verbPairUnitsOf — 生まれる/産む shares no kanji, so base is empty", () => {
  const pair = transitivityItems().find(
    (i) => String(i.entry) === "transitivity:生まれる/産む",
  );
  assert.ok(pair, "the born/give-birth pair is present");
  const [unit] = verbPairUnitsOf(pair!);
  assert.equal(unit.base, "", "the two verbs use different kanji — no shared base");
});

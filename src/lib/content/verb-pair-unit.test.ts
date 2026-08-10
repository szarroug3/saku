// Run: node --import ./src/lib/conjugate/test-hooks.mjs --test src/lib/content/verb-pair-unit.test.ts

import assert from "node:assert/strict";
import test from "node:test";

import { transitivityItems, verbPairUnitsOf } from "./verb-pair-unit.ts";
import { curriculumPosition } from "@/lib/curriculum-order";

test("transitivityItems — a non-empty list of pair items builds", () => {
  const items = transitivityItems();
  assert.ok(items.length > 0, "enumerates verb pairs");
  assert.ok(
    items.every((i) => i.kind === "transitivity"),
    "every item is a transitivity item",
  );
});

test("transitivityItems — a pair is BLOCKED BY its two member verbs, not taught with kanji", () => {
  const open = transitivityItems().find(
    (i) => String(i.entry) === "transitivity:開く/開ける",
  )!;
  assert.deepEqual(open.prereqs, [], "no teaching prereqs — the kanji are not pulled in");
  assert.deepEqual(
    open.blockedBy,
    ["word:開く", "word:開ける"],
    "the pair waits on knowing both verbs",
  );
  const born = transitivityItems().find(
    (i) => String(i.entry) === "transitivity:生まれる/産む",
  )!;
  assert.deepEqual(born.blockedBy, ["word:生まれる", "word:産む"], "the born pair needs both verbs");
});

test("transitivityItems — pairs are ordered by when their shared kanji is taught", () => {
  const items = transitivityItems();
  // The shared kanji is the base on each pair's unit; single-kanji pairs run in
  // non-decreasing vocab-spine order.
  const shared = items
    .map((i) => verbPairUnitsOf(i)[0].base)
    .filter((base) => base !== "")
    .map((base) => curriculumPosition(base))
    .filter((p) => p >= 0); // taught kanji only
  for (let k = 1; k < shared.length; k++) {
    assert.ok(shared[k - 1] <= shared[k], "shared-kanji pairs follow the vocab teaching order");
  }
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

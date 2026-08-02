// Run: node --import ./src/lib/conjugate/test-hooks.mjs --test \
//        src/components/results/clear-state.test.ts

import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { kanaFact } from "@/data/characters.ts";
import { addClearedFact, clearActionLabel } from "@/components/results/clear-state.ts";

describe("results clear-state helpers", () => {
  test("addClearedFact returns a new set containing the fact", () => {
    const fact = kanaFact("あ");
    const prev = new Set([kanaFact("い")]);
    const next = addClearedFact(prev, fact);

    assert.equal(prev.has(fact), false, "input set is not mutated");
    assert.equal(next.has(fact), true, "next set includes cleared fact");
  });

  test("clearActionLabel matches UI copy", () => {
    assert.equal(clearActionLabel(false), "Clear now");
    assert.equal(clearActionLabel(true), "Cleared");
  });
});

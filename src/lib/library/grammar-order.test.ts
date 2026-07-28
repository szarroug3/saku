// Run: node --import ./src/lib/conjugate/test-hooks.mjs --test \
//        src/lib/library/grammar-order.test.ts
//
// WHAT THESE TESTS ARE FOR
// ========================
// `grammarRank` is the key the grammar shelf sorts on so it reads in TEACHING
// order — the pattern below the one you are on is the pattern you study next
// (see grammar-order.ts and the GRAMMAR_SUBJECT branch of shelfSections). Three
// things have to hold:
//
//   1. It ranks EVERY recipe, not just the drillable ones — the shelf shows all
//      96, recognition-only patterns included, and each needs a place.
//   2. For the drillable subset the order it produces IS the curriculum's own
//      order (CURRICULUM_PATTERNS). This is the pin against drift: grammar-order
//      re-derives the sort keys (te-sequence first, level tier, authored tail)
//      rather than importing grammar-lesson's private ones, so this test is what
//      guarantees the two never diverge.
//   3. The shelf's per-level ordering — RECIPES of a level, sorted by
//      grammarRank, which is exactly what shelfSections does — reads in lesson
//      order: te-sequence leads N5, and within each level the drillable patterns
//      appear in curriculum order.
//
// shelfSections itself lives in a .tsx the test runner cannot load, so these
// tests reproduce its one line of ordering logic over the same inputs.

import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { CURRICULUM_PATTERNS } from "@/lib/grammar-lesson";
import { RECIPES } from "@/data/grammar/recipes";
import type { Level } from "@/data/grammar/recipes";
import {
  GRAMMAR_TEACHING_ORDER,
  grammarRank,
} from "@/lib/library/grammar-order";

/** The shelf's own ordering, for one level: every recipe of that level, sorted
 * by grammarRank. This is the exact expression the GRAMMAR_SUBJECT branch of
 * shelfSections maps over — kept in step so this test pins what the shelf does. */
function shelfLevel(level: Level): string[] {
  return RECIPES.filter((r) => r.level === level)
    .slice()
    .sort((a, b) => grammarRank(a.id) - grammarRank(b.id))
    .map((r) => r.id);
}

describe("grammarRank ranks every pattern in teaching order", () => {
  test("every recipe is ranked exactly once, densely 0..N-1", () => {
    assert.equal(GRAMMAR_TEACHING_ORDER.length, RECIPES.length);
    const ranks = RECIPES.map((r) => grammarRank(r.id)).sort((a, b) => a - b);
    assert.deepEqual(ranks, RECIPES.map((_, i) => i));
  });

  test("an unknown id sorts to the very end, it does not throw", () => {
    assert.ok(grammarRank("no-such-pattern") > grammarRank(RECIPES[RECIPES.length - 1].id));
  });

  test("te-sequence leads the whole order", () => {
    assert.equal(GRAMMAR_TEACHING_ORDER[0].id, "te-sequence");
    assert.equal(grammarRank("te-sequence"), 0);
  });

  test("the order is level-monotone: N5 then N4 then N3, never back", () => {
    const tier = { N5: 0, N4: 1, N3: 2 } as const;
    let seen = -1;
    for (const r of GRAMMAR_TEACHING_ORDER) {
      assert.ok(tier[r.level] >= seen, `${r.id} (${r.level}) goes backwards`);
      seen = Math.max(seen, tier[r.level]);
    }
  });
});

describe("the drillable order IS the curriculum order (no drift)", () => {
  test("the drillable subsequence of the teaching order equals CURRICULUM_PATTERNS", () => {
    const drillable = new Set(CURRICULUM_PATTERNS.map((r) => r.id));
    const sub = GRAMMAR_TEACHING_ORDER.filter((r) => drillable.has(r.id)).map((r) => r.id);
    assert.deepEqual(sub, CURRICULUM_PATTERNS.map((r) => r.id));
  });
});

describe("the grammar shelf is ordered by grammarRank within each level section", () => {
  test("every level section is non-empty and the three cover all recipes", () => {
    const n5 = shelfLevel("N5");
    const n4 = shelfLevel("N4");
    const n3 = shelfLevel("N3");
    assert.ok(n5.length > 0 && n4.length > 0 && n3.length > 0, "N3 is now taught");
    assert.equal(n5.length + n4.length + n3.length, RECIPES.length, "all patterns appear");
  });

  test("te-sequence heads the N5 section", () => {
    assert.equal(shelfLevel("N5")[0], "te-sequence");
  });

  test("within each level the drillable patterns keep curriculum order", () => {
    const byLevel = (lv: Level) => new Set(CURRICULUM_PATTERNS.filter((r) => r.level === lv).map((r) => r.id));
    for (const lv of ["N5", "N4", "N3"] as const) {
      const wanted = CURRICULUM_PATTERNS.filter((r) => r.level === lv).map((r) => r.id);
      const drillable = byLevel(lv);
      const got = shelfLevel(lv).filter((id) => drillable.has(id));
      assert.deepEqual(got, wanted, `${lv} shelf order diverges from the curriculum`);
    }
  });

  test("a shelf row sorts by grammarRank, so its ranks only ever increase", () => {
    for (const lv of ["N5", "N4", "N3"] as const) {
      const ranks = shelfLevel(lv).map((id) => grammarRank(id));
      for (let i = 1; i < ranks.length; i += 1) {
        assert.ok(ranks[i] > ranks[i - 1], `${lv} row is not strictly rank-ascending`);
      }
    }
  });
});

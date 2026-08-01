// Run: node --import ./src/lib/conjugate/test-hooks.mjs --test \
//        src/lib/library/grammar-order.test.ts
//
// WHAT THESE TESTS ARE FOR
// ========================
// `grammarRank` is the key the grammar shelf sorts on so it reads in TEACHING
// order — the pattern below the one you are on is the pattern you study next
// (see grammar-order.ts, and grammar-shelf.ts which cuts the shelf by form and
// orders each section by this rank). Three things have to hold:
//
//   1. It ranks EVERY recipe, not just the drillable ones — the shelf shows all
//      of them, recognition-only patterns included, and each needs a place.
//   2. For the drillable subset the order it produces IS the curriculum's own
//      order (CURRICULUM_PATTERNS). This is the pin against drift: grammar-order
//      re-derives the sort keys (te-sequence first, level tier, authored tail)
//      rather than importing grammar-lesson's private ones, so this test is what
//      guarantees the two never diverge.
//   3. The rank is LEVEL-MONOTONE and lesson-ordered — te-sequence leads, and
//      within a level the patterns appear in curriculum order. The shelf is cut
//      by FORM now, not by level (see grammar-shelf.test.ts for that cut), but a
//      section still orders its patterns by this rank, so its within-level
//      behaviour is what these tests pin.

import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { CURRICULUM_LESSONS } from "@/data/grammar/lessons";
import { RECIPES } from "@/data/grammar/recipes";
import type { Level } from "@/data/grammar/recipes";
import {
  GRAMMAR_TEACHING_ORDER,
  grammarRank,
} from "@/lib/library/grammar-order";

/** Every recipe of one level, sorted by grammarRank. Not the shelf's cut any
 * more (the shelf is cut by form), but the per-level order grammarRank produces —
 * the invariant grammar-shelf.ts leans on when it orders each form section by the
 * same rank. */
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

  test("the adjective noun form leads the whole order, before the te-form", () => {
    assert.deepEqual(
      GRAMMAR_TEACHING_ORDER.slice(0, 2).map((r) => r.id),
      ["prenominal-form", "te-sequence"],
    );
    assert.equal(grammarRank("prenominal-form"), 0);
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

describe("the shelf order IS the lesson order (no drift)", () => {
  test("the teaching order equals CURRICULUM_LESSONS, pattern for pattern", () => {
    // grammar-order derives its rank FROM CURRICULUM_LESSONS, so the shelf reads
    // in the exact order the track teaches — 〜ている second, behind the bare
    // て-form it builds on, not in its authored spot. This is the pin against a
    // future edit re-deriving a sort that drifts from the lessons.
    assert.deepEqual(
      GRAMMAR_TEACHING_ORDER.map((r) => r.id),
      CURRICULUM_LESSONS.flatMap((l) => l.recipeIds ?? [l.primaryPattern]),
    );
  });
});

describe("grammarRank is level-monotone and keeps the lesson order per level", () => {
  test("every level is non-empty and the three cover all recipes", () => {
    const n5 = shelfLevel("N5");
    const n4 = shelfLevel("N4");
    const n3 = shelfLevel("N3");
    assert.ok(n5.length > 0 && n4.length > 0 && n3.length > 0, "N3 is now taught");
    assert.equal(n5.length + n4.length + n3.length, RECIPES.length, "all patterns appear");
  });

  test("the adjective noun form leads the N5 patterns", () => {
    assert.equal(shelfLevel("N5")[0], "prenominal-form");
  });

  test("within each level the rank keeps the lesson order", () => {
    const recipeById = new Map(RECIPES.map((r) => [r.id, r]));
    const lessonOrder = CURRICULUM_LESSONS.flatMap(
      (l) => l.recipeIds ?? [l.primaryPattern],
    );
    for (const lv of ["N5", "N4", "N3"] as const) {
      const wanted = lessonOrder.filter((id) => recipeById.get(id)?.level === lv);
      assert.deepEqual(shelfLevel(lv), wanted, `${lv} order diverges from the lessons`);
    }
  });

  test("sorted by grammarRank a level's ranks only ever increase", () => {
    for (const lv of ["N5", "N4", "N3"] as const) {
      const ranks = shelfLevel(lv).map((id) => grammarRank(id));
      for (let i = 1; i < ranks.length; i += 1) {
        assert.ok(ranks[i] > ranks[i - 1], `${lv} is not strictly rank-ascending`);
      }
    }
  });
});

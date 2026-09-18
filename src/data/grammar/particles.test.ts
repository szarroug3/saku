// Run:
//   node --import ./src/lib/conjugate/test-hooks.mjs --test src/data/grammar/particles.test.ts
//
// The Particle page's list (SAK-466). Two things are worth holding: that the
// rows are the recipes and not a second copy of them, and that every row has a
// page to open. The third is the boundary this file draws, which is that the
// copula is not a particle, and that the same boundary is the one the selection
// gate uses.

import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { COPULA_RECIPE_IDS, PARTICLE_RECIPE_IDS, PARTICLE_ROWS } from "./particles";
import { primaryPatternRecipe, recipe } from "./recipes";
import { patternEntry } from "@/data/grammar";
import { libEntry } from "@/lib/library/entries";
import type { EntryId } from "@/types/facts";

describe("the particles Saku teaches", () => {
  test("every named id is a recipe, named once", () => {
    for (const id of [...PARTICLE_RECIPE_IDS, ...COPULA_RECIPE_IDS]) {
      assert.ok(recipe(id), `'${id}' is not a recipe`);
    }
    assert.equal(new Set(PARTICLE_RECIPE_IDS).size, PARTICLE_RECIPE_IDS.length);
    for (const id of COPULA_RECIPE_IDS) {
      assert.ok(!PARTICLE_RECIPE_IDS.includes(id), `the copula '${id}' is on the particle list`);
    }
  });

  test("there is a row per particle, in the list's order", () => {
    assert.deepEqual(PARTICLE_ROWS.map((p) => p.recipeId), [...PARTICLE_RECIPE_IDS]);
  });

  test("nothing on a row is written here: it is the recipe's own", () => {
    for (const p of PARTICLE_ROWS) {
      const r = recipe(p.recipeId)!;
      assert.equal(p.does, r.gloss, `'${p.recipeId}' does not say what its recipe says`);
      assert.equal(`〜${p.particle}`, r.pattern, `'${p.recipeId}' is not written the way its recipe writes it`);
    }
  });

  test("every row opens a page that exists", () => {
    for (const p of PARTICLE_ROWS) {
      assert.ok(libEntry(p.entry as EntryId), `'${p.recipeId}' opens '${p.entry}', which is not an entry`);
      // the page a written pattern has is its first sense's, so から's row
      // opens the page that holds both "because" and "from"
      assert.equal(p.entry, patternEntry(primaryPatternRecipe(p.recipeId)!.id));
    }
  });

  test("every row shows a sentence, and the particle is written in it", () => {
    for (const p of PARTICLE_ROWS) {
      assert.ok(p.example, `'${p.recipeId}' has no sentence`);
      // しか〜ない is the one particle written in two pieces, so its own
      // spelling is not in the sentence; the rest are
      if (p.particle.includes("〜")) continue;
      assert.ok(p.example!.jp.includes(p.particle), `'${p.recipeId}' shows a sentence without ${p.particle} in it`);
    }
  });

  test("the ones the learner meets first are the case particles", () => {
    assert.deepEqual(PARTICLE_ROWS.slice(0, 6).map((p) => p.particle), ["は", "が", "を", "に", "で", "へ"]);
  });
});

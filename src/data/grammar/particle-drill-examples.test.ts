// Checks for the particle-drill example lane — mirrors authored.test.ts's
// span checks. See docs/particle-teaching-workplan.md "Package 3".

import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { PARTICLE_DRILL_EXAMPLES } from "./particle-drill-examples.ts";
import { recipe } from "./recipes.ts";

describe("the particle-drill example lane", () => {
  test("every id is negative and unique — never a Tatoeba permalink", () => {
    const seen = new Set<number>();
    for (const ex of PARTICLE_DRILL_EXAMPLES) {
      assert.ok(ex.id < 0, `particle-drill ${ex.id} (${ex.jp}) is not a negative id`);
      assert.ok(!seen.has(ex.id), `particle-drill id ${ex.id} is reused`);
      seen.add(ex.id);
    }
  });

  test("every row's recipe id exists in RECIPES", () => {
    for (const ex of PARTICLE_DRILL_EXAMPLES) {
      assert.ok(recipe(ex.recipe), `particle-drill ${ex.id}: unknown recipe "${ex.recipe}"`);
    }
  });

  test("particleSpan and markedWordSpan are in-bounds and don't overlap", () => {
    for (const ex of PARTICLE_DRILL_EXAMPLES) {
      for (const [label, [start, end]] of [
        ["particleSpan", ex.particleSpan],
        ["markedWordSpan", ex.markedWordSpan],
      ] as const) {
        assert.ok(
          start >= 0 && end <= ex.jp.length && start < end,
          `particle-drill ${ex.id}: bad ${label} [${start}, ${end}] for "${ex.jp}"`,
        );
      }
      const [pStart, pEnd] = ex.particleSpan;
      const [mStart, mEnd] = ex.markedWordSpan;
      const overlap = pStart < mEnd && pEnd > mStart;
      assert.ok(!overlap, `particle-drill ${ex.id}: particleSpan overlaps markedWordSpan`);
    }
  });

  test("distractorSpans are in-bounds, non-empty, and don't overlap the marked spans", () => {
    for (const ex of PARTICLE_DRILL_EXAMPLES) {
      assert.ok(ex.distractorSpans.length >= 1, `particle-drill ${ex.id}: no distractor spans`);
      for (const [start, end] of ex.distractorSpans) {
        assert.ok(
          start >= 0 && end <= ex.jp.length && start < end,
          `particle-drill ${ex.id}: bad distractor span [${start}, ${end}] for "${ex.jp}"`,
        );
        const overlapsParticle = start < ex.particleSpan[1] && end > ex.particleSpan[0];
        const overlapsMarked = start < ex.markedWordSpan[1] && end > ex.markedWordSpan[0];
        assert.ok(
          !overlapsParticle && !overlapsMarked,
          `particle-drill ${ex.id}: distractor span [${start}, ${end}] overlaps the marked spans`,
        );
      }
    }
  });

  test("particleSpan's slice matches the recipe's bare pattern text", () => {
    for (const ex of PARTICLE_DRILL_EXAMPLES) {
      const [start, end] = ex.particleSpan;
      const slice = ex.jp.slice(start, end);
      const bare = recipe(ex.recipe)?.pattern.replace(/[〜]/g, "") ?? "";
      // A wrap like しか〜ない highlights only its opening half (しか), shorter
      // than the full pattern text — see authored.test.ts's identical check.
      assert.ok(
        slice.endsWith(bare) || bare.startsWith(slice),
        `particle-drill ${ex.id}: particleSpan slice "${slice}" does not match pattern ${bare}`,
      );
    }
  });

  test("the tagged particle text appears exactly once in the sentence", () => {
    // particle-tap-card.tsx no longer marks the particle chunk apart visually
    // (it's boxed like every other piece — a highlighted particle made the
    // answer's boundary too easy to spot without reading the sentence). That
    // removed the one thing that would have told a learner WHICH occurrence
    // was in question if the same particle text turned up twice, so this is
    // now load-bearing: every sentence here must have exactly one.
    for (const ex of PARTICLE_DRILL_EXAMPLES) {
      const particleText = ex.jp.slice(ex.particleSpan[0], ex.particleSpan[1]);
      let count = 0;
      for (let i = ex.jp.indexOf(particleText); i !== -1; i = ex.jp.indexOf(particleText, i + 1)) {
        count++;
      }
      assert.equal(
        count,
        1,
        `particle-drill ${ex.id}: "${particleText}" appears ${count} times in "${ex.jp}"`,
      );
    }
  });
});

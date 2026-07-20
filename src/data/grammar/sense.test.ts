// Run:
//   node --import ./src/lib/conjugate/test-hooks.mjs --test src/data/grammar/sense.test.ts
//
// The sense label is what keeps two patterns that share a bare form apart:
// 〜られる is both 可能 (potential) and 受身 (passive), and 〜から is both 理由
// (reason) and 起点 (source). The `pattern` string is the same for each pair, so
// everything that identifies a pattern to a reader has to reach for `sense` too,
// or the two members become the same button, the same row, the same glyph. These
// tests pin that: the sense lives in its own field, patternLabel folds it back in
// for the string-only surfaces, and the shared-form pairs come out distinct.

import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { GRAMMAR_FACTS, patternMeaningFactId } from "./index";
import { RECIPES, patternLabel, recipe } from "./recipes";

// The pairs the whole feature exists for: same pattern, different sense.
const SHARED_FORM_PAIRS: readonly [string, string][] = [
  ["potential", "passive"], // both 〜られる
  ["kara-reason", "kara-source"], // both 〜から
];

describe("grammar sense labels", () => {
  test("a sense-bearing recipe keeps its sense out of the pattern string", () => {
    const sensed = RECIPES.filter((r) => r.sense);
    assert.equal(sensed.length, 6, "expected exactly six sense-bearing recipes");
    for (const r of sensed) {
      assert.ok(
        !r.pattern.includes(r.sense!),
        `${r.id} pattern "${r.pattern}" still bakes in its sense`,
      );
    }
  });

  test("patternLabel appends a sense-bearing recipe's sense, halfwidth and spaced", () => {
    assert.equal(patternLabel(recipe("potential")!), "〜られる (可能)");
    assert.equal(patternLabel(recipe("kara-source")!), "〜から (起点)");
    assert.equal(patternLabel(recipe("sou-hearsay")!), "〜そうだ (伝聞)");
  });

  test("patternLabel leaves a senseless recipe bare", () => {
    const bare = RECIPES.filter((r) => !r.sense);
    assert.ok(bare.length > 0, "expected some recipes to carry no sense");
    for (const r of bare) {
      assert.equal(patternLabel(r), r.pattern, `${r.id} should render bare`);
    }
  });

  test("each shared-form pair shares a bare pattern but reads apart with sense", () => {
    for (const [a, b] of SHARED_FORM_PAIRS) {
      const ra = recipe(a)!;
      const rb = recipe(b)!;
      assert.equal(ra.pattern, rb.pattern, `${a}/${b} should share a bare form`);
      assert.notEqual(
        patternLabel(ra),
        patternLabel(rb),
        `${a}/${b} must not render as the same label`,
      );
    }
  });

  test("the meaning fact's glyph carries the sense, so results and browse disambiguate", () => {
    const glyphOfMeaning = (id: string): string | undefined =>
      GRAMMAR_FACTS.find((f) => f.id === patternMeaningFactId(id))?.glyph;
    for (const [a, b] of SHARED_FORM_PAIRS) {
      const ga = glyphOfMeaning(a);
      const gb = glyphOfMeaning(b);
      assert.equal(ga, patternLabel(recipe(a)!));
      assert.notEqual(ga, gb, `${a}/${b} meaning glyphs must differ`);
    }
  });
});

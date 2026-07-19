// Run:
//   node --import ./src/lib/conjugate/test-hooks.mjs --test src/data/grammar/shared-rule.test.ts
//
// THE TWO EMPTY CELLS, AND WHY THEY NEEDED A TEST
// ==============================================
// "How to build it" (components/library/pattern-recipe.tsx) is one row per host
// with a score chip in the last column, and some rows have no chip for two
// COMPLETELY DIFFERENT reasons that used to render identically:
//
//   1. Nothing happens to the word. 〜ので's verb row is 行く + ので. There is no
//      rule, so there is nothing to score anywhere, and the row already says so
//      — its own middle chip reads "just as it is". Blank is correct.
//   2. The rule is scored on another pattern's page. 〜ても's い-adjective row is
//      高い → 高くて, and 〜て owns い → くて. Blank was a DEFECT: the row visibly
//      transforms, shows nothing, and points nowhere.
//
// `sharedRuleOwner` is the function that tells them apart, and the whole of the
// difference lives in its answer, so this is where it is pinned. The component
// only typesets what it returns.
//
// WHY THE POPULATION IS ASSERTED AND NOT JUST THE TWO KNOWN CASES
// ==============================================================
// A test naming 〜ても and 〜てもいい passes forever while a new deferring recipe
// silently gets nothing, and it also passes if the note starts appearing on rows
// that DO carry a chip. So the sweep below is over all 81 recipes and asserts
// the exact set both ways: every unscored row's answer, and every scored row's
// silence.

import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { productionHosts, sharedRuleOwner } from "./index";
import { RECIPES, isProducible, recipe } from "./recipes";
import { recipeFormula } from "../../lib/grammar/formula";

/** Every (recipe, host) the card actually draws a cell for: one per row of the
 * opening half, on the recipes whose score column is shown at all. */
function scoredColumnRows(): { r: (typeof RECIPES)[number]; host: ReturnType<typeof productionHosts>[number] }[] {
  const rows = [];
  for (const r of RECIPES) {
    const scored = new Set(isProducible(r) ? productionHosts(r) : []);
    const { opening } = recipeFormula(r);
    if (!opening.some((f) => scored.has(f.host))) continue; // no column at all
    for (const f of opening) rows.push({ r, host: f.host });
  }
  return rows;
}

describe("sharedRuleOwner marks the rows scored on another pattern's page", () => {
  test("a scored row never carries the note", () => {
    for (const { r, host } of scoredColumnRows()) {
      if (!productionHosts(r).includes(host)) continue;
      assert.equal(
        sharedRuleOwner(r, host),
        undefined,
        `${r.id}/${host} has a chip AND a "same rule as" line`,
      );
    }
  });

  test("an unscored row carries it exactly when its recipe defers", () => {
    for (const { r, host } of scoredColumnRows()) {
      if (productionHosts(r).includes(host)) continue;
      const owner = sharedRuleOwner(r, host);
      if (r.sharedProductionWith) {
        assert.ok(owner, `${r.id}/${host} defers but names no owner`);
        assert.equal(owner.id, r.sharedProductionWith);
      } else {
        // Reason 1. Nothing happens to the word; the cell stays blank.
        assert.equal(
          owner,
          undefined,
          `${r.id}/${host} transforms nothing and must stay silent`,
        );
      }
    }
  });

  test("the pattern it names really does score that host", () => {
    // The link's whole promise is "the score is over there". A deferral to a
    // recipe that does not score the host would send the reader to a page with
    // no chip for the rule they were just told it owns.
    for (const { r, host } of scoredColumnRows()) {
      const owner = sharedRuleOwner(r, host);
      if (!owner) continue;
      assert.ok(
        productionHosts(owner).includes(host),
        `${r.id}/${host} points at ${owner.id}, which does not score ${host}`,
      );
    }
  });

  test("the shipped population is 〜ても and 〜てもいい, on adj-i, both owned by 〜て", () => {
    // Not the point of the sweep above, which is general. This is the count the
    // change was measured against, so a recipe quietly gaining or losing a
    // deferral shows up as a diff here rather than as a surprise on screen.
    const marked = scoredColumnRows()
      .map(({ r, host }) => ({ r, host, owner: sharedRuleOwner(r, host) }))
      .filter((x) => x.owner)
      .map((x) => `${x.r.pattern}/${x.host} → ${x.owner!.pattern}`);
    assert.deepEqual(marked, ["〜てもいい/adj-i → 〜て", "〜ても/adj-i → 〜て"]);
  });

  test("〜ので's two blanks stay blank", () => {
    const node = recipe("node");
    assert.ok(node);
    for (const host of ["verb", "adj-i"] as const) {
      assert.ok(!productionHosts(node).includes(host));
      assert.equal(sharedRuleOwner(node, host), undefined);
    }
    // And its な-adjective row is still the one that IS scored, so the card is
    // genuinely mixed and the two blanks sit next to a chip.
    assert.deepEqual(productionHosts(node), ["adj-na"]);
  });

  test("a pattern with no score column is unaffected", () => {
    // 〜ことができる conjugates nothing, so the column and its header are dropped
    // whole. Nothing here may resurrect a cell.
    const koto = recipe("koto-ga-dekiru");
    assert.ok(koto);
    assert.equal(isProducible(koto), false);
    for (const f of recipeFormula(koto).opening) {
      assert.equal(sharedRuleOwner(koto, f.host), undefined);
    }
    // 〜たり〜たり transforms on its unscored row but is unproducible outright,
    // so it has no column either and must not gain one.
    const tari = recipe("tari-tari");
    assert.ok(tari);
    assert.equal(isProducible(tari), false);
    for (const f of recipeFormula(tari).opening) {
      assert.equal(sharedRuleOwner(tari, f.host), undefined);
    }
  });
});

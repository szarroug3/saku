// SAK-191: appliedGloss's adjective/noun branch (auto-page.ts, the !ex.ing arm)
// had none of the verb branch's scaffold-stripping — a blind `X` -> filled
// substitution left the verb-only scaffold words ("do", "did") sitting in front
// of an adjective, and left a verb-only alternative half ("do X too much",
// "looks like it will X") in a reading that no longer has a verb to describe.
// These pin the derive-table Meaning column text for every multi-host recipe
// whose adjective/noun side was broken, plus the sibling recipes that already
// read correctly and must not regress.

import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { autoPatternPage } from "./auto-page.ts";
import { recipe } from "./recipes.ts";

/** The gloss text for a recipe's named derive-table section, first row. */
function sectionGloss(recipeId: string, title: string): string {
  const r = recipe(recipeId)!;
  const page = autoPatternPage(r);
  const section = page.deriveTables?.find((t) => t.title === title);
  assert.ok(section, `${recipeId} has no "${title}" section`);
  assert.ok(section!.rules.length > 0, `${recipeId}/${title} has no rows`);
  return section!.rules[0].gloss ?? "";
}

describe("appliedGloss on a non-verb vehicle (SAK-191)", () => {
  test("te-sequence: the 'do X' clause reads as the copula, not a verb", () => {
    assert.equal(
      sectionGloss("te-sequence", "い-adjectives"),
      "is expensive, and then / because expensive",
    );
    assert.equal(
      sectionGloss("te-sequence", "な-adjectives"),
      "is quiet, and then / because quiet",
    );
  });

  test("te-permission: 'may do X' takes the modal's bare copula", () => {
    assert.equal(sectionGloss("te-permission", "い-adjectives"), "may be expensive");
  });

  test("ta-form: 'did X' becomes the copula's past tense", () => {
    assert.equal(sectionGloss("ta-form", "い-adjectives"), "plain past, “was expensive”");
    assert.equal(sectionGloss("ta-form", "な-adjectives"), "plain past, “was quiet”");
  });

  test("sugiru: the verb-only 'do X too much' half is dropped, not filled", () => {
    assert.equal(sectionGloss("sugiru", "い-adjectives"), "too expensive");
    assert.equal(sectionGloss("sugiru", "な-adjectives"), "too quiet");
  });

  test("sou-appearance: the verb-only 'looks like it will X' half is dropped", () => {
    assert.equal(sectionGloss("sou-appearance", "い-adjectives"), "looks expensive");
    assert.equal(sectionGloss("sou-appearance", "な-adjectives"), "looks quiet");
  });

  test("no fixed case leaves a bare scaffold word ('do'/'did') beside the filled word", () => {
    for (const [id, title] of [
      ["te-sequence", "い-adjectives"],
      ["te-sequence", "な-adjectives"],
      ["te-permission", "い-adjectives"],
      ["ta-form", "い-adjectives"],
      ["ta-form", "な-adjectives"],
      ["sugiru", "い-adjectives"],
      ["sugiru", "な-adjectives"],
      ["sou-appearance", "い-adjectives"],
      ["sou-appearance", "な-adjectives"],
    ] as const) {
      assert.ok(!/\bdo (?:expensive|quiet)\b/.test(sectionGloss(id, title)), `${id}/${title}`);
      assert.ok(!/\bdid (?:expensive|quiet)\b/.test(sectionGloss(id, title)), `${id}/${title}`);
    }
  });

  // These already read fine before the fix (no "do X"/"did X" scaffold, no
  // verb-only alt to strip) and must keep reading exactly the same after it.
  test("te-mo, ba, tara and node are unchanged: terse, no dangling scaffold", () => {
    assert.equal(sectionGloss("te-mo", "い-adjectives"), "even if expensive");
    assert.equal(sectionGloss("ba", "い-adjectives"), "if expensive");
    assert.equal(sectionGloss("tara", "い-adjectives"), "if/when expensive");
    assert.equal(sectionGloss("tara", "な-adjectives"), "if/when quiet");
    assert.equal(sectionGloss("node", "い-adjectives"), "because expensive");
    assert.equal(sectionGloss("node", "な-adjectives"), "because quiet");
  });
});

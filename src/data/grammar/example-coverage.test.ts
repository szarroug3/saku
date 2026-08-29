// SAK-276: every grammar recipe either has a linked example (corpus or
// hand-authored — examplesFor() does not distinguish) or an explicit,
// documented reason in CORPUS_META.noSignature. Before this test, a recipe
// added to RECIPES with neither was a SILENT zero: nothing failed, nothing
// printed, and it took a manual cross-reference audit to find 18 of them
// (SAK-174's だ/です/も/ね/よ/って/と-and/がない, the bare FORM lessons
// nai-form/ta-form/masu-form/stem-form/volitional-form/prenominal-form, the
// aspectual verbs たがる/始める/続ける, and ta-ato-de, which had a note asking for
// hand-authored examples that nobody had gotten to). This is the gate that
// makes the NEXT one loud instead of silent.

import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { CORPUS_META, examplesFor } from "./corpus.ts";
import { RECIPES } from "./recipes.ts";

describe("SAK-276: no recipe is a silent example gap", () => {
  test("every recipe has an example or a documented noSignature reason", () => {
    const gaps = RECIPES.filter((r) => {
      const hasExample = examplesFor(r.id).length > 0;
      const hasReason = Object.prototype.hasOwnProperty.call(CORPUS_META.noSignature, r.id);
      return !hasExample && !hasReason;
    }).map((r) => r.id);
    assert.deepEqual(gaps, [], `${gaps.length} recipe(s) have neither an example nor a documented reason`);
  });

  test("every noSignature key still names a real recipe", () => {
    // The inverse drift: a recipe renamed or removed leaves a stale key that
    // silently stops meaning anything.
    const ids = new Set(RECIPES.map((r) => r.id));
    const stale = Object.keys(CORPUS_META.noSignature).filter((k) => !ids.has(k));
    assert.deepEqual(stale, [], `noSignature key(s) with no matching recipe: ${stale.join(", ")}`);
  });
});

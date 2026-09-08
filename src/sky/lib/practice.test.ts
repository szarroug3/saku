// A recipe is a description and nothing in it is ordered, so two recipes
// that draw the same deck are one recipe (SAK-372). And what a saved
// recipe's chip says about itself.

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { canonicalRecipe, EMPTY_RECIPE, recipeKey, recipeSummary, sameRecipe, type PracticeCollection, type Recipe } from "./practice";

const recipe = (over: Partial<Recipe> = {}): Recipe => ({ ...EMPTY_RECIPE, ...over });

/** The page's own round trip: a recipe packed into the URL and unpacked by
 * the run page, which fills anything missing from EMPTY_RECIPE. */
const throughUrl = (r: Recipe): Recipe =>
  ({ ...EMPTY_RECIPE, ...(JSON.parse(decodeURIComponent(encodeURIComponent(JSON.stringify(r)))) as Partial<Recipe>) });

const COLLECTIONS: readonly PracticeCollection[] = [
  { id: "kana", title: "Kana", total: 104, cuts: [{ id: "hiragana", label: "Hiragana", group: "Script" }, { id: "yoon", label: "Yōon", group: "Row type" }] },
  { id: "kanji", title: "Kanji", total: 2136 },
  { id: "words", title: "Words", total: 12000 },
];

describe("sameRecipe", () => {
  it("does not care which chip was clicked first", () => {
    assert.ok(sameRecipe(recipe({ collections: ["kana", "words"] }), recipe({ collections: ["words", "kana"] })));
    assert.ok(sameRecipe(recipe({ statuses: ["shaky", "solid"] }), recipe({ statuses: ["solid", "shaky"] })));
    assert.ok(sameRecipe(recipe({ asks: ["reading", "meaning"] }), recipe({ asks: ["meaning", "reading"] })));
    assert.ok(sameRecipe(recipe({ excluded: ["b", "a"] }), recipe({ excluded: ["a", "b"] })));
  });

  it("does not care where a collection's cuts landed in the object", () => {
    // toggleCut rebuilds cuts as { ...rest, [collection]: next }, which moves
    // the collection it touched to the end
    const a = recipe({ collections: ["kana", "grammar"], cuts: { kana: ["hiragana", "yoon"], grammar: ["form-te"] } });
    const b = recipe({ collections: ["grammar", "kana"], cuts: { grammar: ["form-te"], kana: ["yoon", "hiragana"] } });
    assert.ok(sameRecipe(a, b));
  });

  it("still tells two different decks apart", () => {
    assert.ok(!sameRecipe(recipe({ collections: ["kana"] }), recipe({ collections: ["kana", "words"] })));
    assert.ok(!sameRecipe(recipe({ size: 10 }), recipe({ size: 20 })));
    assert.ok(!sameRecipe(recipe({ size: 10 }), recipe({ size: "all" })));
    assert.ok(!sameRecipe(recipe({ cuts: { kana: ["hiragana"] } }), recipe({ cuts: { kana: ["katakana"] } })));
    assert.ok(!sameRecipe(recipe({ excluded: ["a"] }), recipe()));
  });

  it("survives the round trip through the URL", () => {
    const asked = recipe({ collections: ["words", "kana"], cuts: { kana: ["yoon"] }, statuses: ["shaky"], asks: ["reading", "meaning"], size: 12, excluded: ["word:x"] });
    assert.ok(sameRecipe(asked, throughUrl(asked)));
  });

  it("takes a recipe that is missing its newer fields", () => {
    // an older saved recipe, before excluded and cuts existed
    const old = { collections: ["kana"], statuses: [], asks: [...EMPTY_RECIPE.asks], size: 10 } as unknown as Recipe;
    assert.ok(sameRecipe(old, recipe({ collections: ["kana"] })));
  });
});

describe("recipeKey", () => {
  it("parses back to a recipe that draws the same deck", () => {
    const asked = recipe({ collections: ["words", "kana"], cuts: { kana: ["yoon", "hiragana"] }, statuses: ["shaky"], size: 12 });
    const back = JSON.parse(recipeKey(asked)) as Recipe;
    assert.ok(sameRecipe(asked, back));
    assert.deepEqual(back, canonicalRecipe(asked));
  });

  it("writes the fields in one order whatever order they were built in", () => {
    const built = { size: 10, asks: [...EMPTY_RECIPE.asks], excluded: [], statuses: [], cuts: {}, collections: [] } as Recipe;
    assert.equal(recipeKey(built), recipeKey(EMPTY_RECIPE));
  });
});

describe("recipeSummary", () => {
  it("says everything when nothing is narrowed", () => {
    assert.equal(recipeSummary(EMPTY_RECIPE, COLLECTIONS), "Everything, 10 of them");
  });

  it("names the collections in the order they are offered, with their cuts", () => {
    const r = recipe({ collections: ["words", "kana"], cuts: { kana: ["yoon", "hiragana"] }, size: "all" });
    assert.equal(recipeSummary(r, COLLECTIONS), "Kana (Hiragana and Yōon) and Words, all of them");
  });

  it("leaves out a clause that says nothing, and keeps the ones that do", () => {
    const r = recipe({ collections: ["kanji"], statuses: ["shaky"], asks: ["meaning", "reading"], size: 10 });
    assert.equal(recipeSummary(r, COLLECTIONS), "Kanji, only shaky, asked for the meaning and the reading, 10 of them");
  });

  it("counts what was left out by hand, since a saved recipe keeps it", () => {
    const r = recipe({ collections: ["kanji"], excluded: ["kanji:一"] });
    assert.equal(recipeSummary(r, COLLECTIONS), "Kanji, 10 of them, less one left out by hand");
    const more = recipe({ collections: ["kanji"], excluded: ["kanji:一", "kanji:二"] });
    assert.equal(recipeSummary(more, COLLECTIONS), "Kanji, 10 of them, less 2 left out by hand");
  });

  it("puts three of anything in a list with commas", () => {
    const r = recipe({ collections: ["kana", "kanji", "words"] });
    assert.equal(recipeSummary(r, COLLECTIONS), "Kana, Kanji and Words, 10 of them");
  });
});

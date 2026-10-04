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

  // SAK-497: "may be expensive" read as a guess about the price. 〜てもいい on
  // an adjective says the price is acceptable.
  test("te-permission: an adjective row says it's okay even so", () => {
    assert.equal(
      sectionGloss("te-permission", "い-adjectives"),
      "it's okay even if it's expensive",
    );
  });

  test("ta-form: 'did X' becomes the copula's past tense", () => {
    assert.equal(sectionGloss("ta-form", "い-adjectives"), "plain past, \"was expensive\"");
    assert.equal(sectionGloss("ta-form", "な-adjectives"), "plain past, \"was quiet\"");
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

describe("〜てもいい on all four kinds of word (SAK-496)", () => {
  test("the page has a section for verbs, both adjectives and nouns, in that order", () => {
    const page = autoPatternPage(recipe("te-permission")!);
    assert.deepEqual(
      page.deriveTables?.map((t) => t.title),
      ["Verbs", "い-adjectives", "な-adjectives", "Nouns"],
    );
  });

  test("the な-adjective and noun rows read with their own written meanings", () => {
    const page = autoPatternPage(recipe("te-permission")!);
    const row = (title: string) => page.deriveTables!.find((t) => t.title === title)!.rules[0];
    assert.equal(row("な-adjectives").result, "しずかでもいい");
    assert.equal(sectionGloss("te-permission", "な-adjectives"), "it's okay even if it's quiet");
    assert.equal(row("Nouns").result, "ほんでもいい");
    assert.equal(sectionGloss("te-permission", "Nouns"), "a book is fine too");
  });
});

describe("〜なくてもいい and 〜てはいけない on all four kinds of word (SAK-505)", () => {
  const cases: [string, [string, string][]][] = [
    [
      "nakute-mo-ii",
      [
        ["い-adjectives", "たかくなくてもいい"],
        ["な-adjectives", "しずかではなくてもいい"],
        ["Nouns", "ほんではなくてもいい"],
      ],
    ],
    [
      "te-prohibition",
      [
        ["い-adjectives", "たかくてはいけない"],
        ["な-adjectives", "しずかではいけない"],
        ["Nouns", "ほんではいけない"],
      ],
    ],
  ];

  for (const [id, rows] of cases) {
    test(`${id}: a section for verbs, both adjectives and nouns, in that order`, () => {
      const page = autoPatternPage(recipe(id)!);
      assert.deepEqual(
        page.deriveTables?.map((t) => t.title),
        ["Verbs", "い-adjectives", "な-adjectives", "Nouns"],
      );
      for (const [title, built] of rows) {
        const results: (string | undefined)[] | undefined = page.deriveTables
          ?.filter((t) => t.title === title)
          .map((t) => t.rules[0]?.result);
        assert.deepEqual(results, [built], `${id}/${title}`);
      }
    });
  }

  test("the adjective and noun rows read with their own written meanings", () => {
    assert.equal(sectionGloss("nakute-mo-ii", "い-adjectives"), "it doesn't have to be expensive");
    assert.equal(sectionGloss("nakute-mo-ii", "な-adjectives"), "it doesn't have to be quiet");
    assert.equal(sectionGloss("nakute-mo-ii", "Nouns"), "it doesn't have to be a book");
    assert.equal(sectionGloss("te-prohibition", "い-adjectives"), "it must not be expensive");
    assert.equal(sectionGloss("te-prohibition", "な-adjectives"), "it must not be quiet");
    assert.equal(sectionGloss("te-prohibition", "Nouns"), "it must not be a book");
  });
});

// SAK-500: a gloss written for a verb left some adjective and noun rows with no
// subject or verb ("I heard that expensive", "in order to a book"). One rule
// covers what someone heard or says. A pattern that means something else on a
// noun has its own `meaning` on the recipe.
describe("adjective and noun rows read as sentences (SAK-500)", () => {
  test("tte: what someone heard or says gets \"it's\"", () => {
    assert.equal(
      sectionGloss("tte", "い-adjectives"),
      "I heard it's expensive / they say it's expensive",
    );
    assert.equal(sectionGloss("tte", "な-adjectives"), "I heard it's quiet / they say it's quiet");
    assert.equal(sectionGloss("tte", "Nouns"), "I heard it's a book / they say it's a book");
  });

  test("sou-hearsay: the same rule, \"I hear it's expensive\"", () => {
    assert.equal(sectionGloss("sou-hearsay", "い-adjectives"), "I hear it's expensive");
  });

  test("nara on a noun: \"if it's a book\"", () => {
    assert.equal(sectionGloss("nara", "Nouns"), "if it's a book");
  });

  test("you-da on a noun: \"it seems to be a book\"", () => {
    assert.equal(sectionGloss("you-da", "Nouns"), "it seems to be a book");
  });

  test("tame-ni on a noun: \"for the sake of a book\"", () => {
    assert.equal(sectionGloss("tame-ni", "Nouns"), "for the sake of a book");
  });

  test("the verb rows of the same patterns keep the recipe's gloss", () => {
    assert.equal(sectionGloss("sou-hearsay", "Verbs"), "I hear that you eat");
    assert.equal(sectionGloss("tame-ni", "Verbs"), "in order to eat");
  });
});

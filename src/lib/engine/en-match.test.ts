// Run: node --import ../conjugate/test-hooks.mjs --test src/lib/engine/en-match.test.ts
//
// The forgiving-but-safe English matcher, layer by layer. The through-line of
// every case is the one guarantee the module makes: it ACCEPTS MORE right
// answers and never accepts a WRONG one. So each describe pairs the answers it
// should now let through with the near-miss-wrong ones it must still reject.

import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { meaningFactId, readingFactId } from "../../data/kanji.ts";
import { wordMeaningFactId } from "../vocab-ids.ts";
import { checkTyped } from "./index.ts";
import {
  digitVariants,
  glossCandidates,
  isEnglishGloss,
  levenshtein,
  matchesEnglish,
  norm,
  stripParentheticals,
  synonymCandidates,
  synonymKeyOf,
  typoBudget,
} from "./en-match.ts";

describe("stripParentheticals — notes come off, everything else stays", () => {
  test("a single trailing note is removed", () => {
    assert.equal(stripParentheticals("line (of text)"), "line");
  });
  test("commas survive as gloss separators", () => {
    assert.equal(
      stripParentheticals("line (of text), row, verse"),
      "line, row, verse",
    );
  });
  test("multiple and nested groups all unwind", () => {
    assert.equal(stripParentheticals("a (b (c)) d (e)"), "a d");
  });
  test("a gloss with no parens is untouched (bar whitespace)", () => {
    assert.equal(stripParentheticals("  teacher  "), "teacher");
  });
});

describe("matchesEnglish — layer 1, parenthetical qualifiers", () => {
  const glosses = ["line (of text), row, verse"];
  test("each stripped, comma-split piece is accepted", () => {
    for (const good of ["line", "row", "verse", "line (of text), row, verse"]) {
      assert.equal(matchesEnglish(good, glosses), true, good);
    }
  });
  test("the whole stripped string is accepted", () => {
    assert.equal(matchesEnglish("line, row, verse", glosses), true);
  });
  test("an unrelated word is still rejected", () => {
    assert.equal(matchesEnglish("column", glosses), false);
  });
});

describe("digitVariants — only numbers present, both forms", () => {
  test("a bare number word yields its digit", () => {
    assert.deepEqual(digitVariants("four"), ["4"]);
  });
  test('"one thing" yields the substituted string AND the bare digit', () => {
    assert.deepEqual(digitVariants("one thing"), ["1 thing", "1"]);
  });
  test("a fragment with no number yields nothing", () => {
    assert.deepEqual(digitVariants("teacher"), []);
  });
  test("word boundaries keep nineteen from becoming 9teen", () => {
    assert.deepEqual(digitVariants("nineteen"), ["19"]);
  });
  test("compound runs compose into one digit, not per-word", () => {
    assert.deepEqual(digitVariants("forty three"), ["43"]);
    assert.deepEqual(digitVariants("forty-three"), ["43"]);
    assert.deepEqual(digitVariants("twenty one"), ["21"]);
    assert.deepEqual(digitVariants("one hundred"), ["100"]);
    assert.deepEqual(digitVariants("one hundred twenty"), ["120"]);
  });
  test("a compound run keeps the surrounding words and offers the bare digit", () => {
    assert.deepEqual(digitVariants("one hundred twenty things"), [
      "120 things",
      "120",
    ]);
  });
});

describe("matchesEnglish — compound numbers reach a fact", () => {
  test('"43" answers "forty three" but a wrong number does not', () => {
    const glosses = ["forty three"];
    assert.equal(matchesEnglish("43", glosses), true);
    assert.equal(matchesEnglish("forty three", glosses), true);
    assert.equal(matchesEnglish("42", glosses), false);
    assert.equal(matchesEnglish("34", glosses), false);
  });
});

describe("matchesEnglish — layer 2, digit forms", () => {
  test('"4" answers the number gloss "four (4)"', () => {
    const glosses = ["four (4)"];
    assert.equal(matchesEnglish("4", glosses), true);
    assert.equal(matchesEnglish("four", glosses), true);
    // A DIFFERENT digit is not manufactured — it never appeared in the gloss.
    assert.equal(matchesEnglish("5", glosses), false);
  });
  test('"1 thing" and "1" answer "one thing"', () => {
    const glosses = ["one thing"];
    assert.equal(matchesEnglish("1 thing", glosses), true);
    assert.equal(matchesEnglish("1", glosses), true);
    assert.equal(matchesEnglish("2 things", glosses), false);
  });
  test('"ten long thin objects, also じっぽん" accepts "10 long thin objects"', () => {
    const glosses = ["ten long thin objects, also じっぽん"];
    assert.equal(matchesEnglish("10 long thin objects", glosses), true);
    assert.equal(matchesEnglish("ten long thin objects", glosses), true);
  });
});

describe("levenshtein / typoBudget — the tuning", () => {
  test("distance is symmetric and correct on the tuning cases", () => {
    assert.equal(levenshtein("ting", "thing"), 1);
    assert.equal(levenshtein("teacer", "teacher"), 1);
    assert.equal(levenshtein("expencive", "expensive"), 1);
    assert.equal(levenshtein("cat", "car"), 1);
    assert.equal(levenshtein("one", "two"), 3);
  });
  test("budget is 0 for very short, 1 for mid, 2 for long", () => {
    assert.equal(typoBudget(3), 0);
    assert.equal(typoBudget(4), 1);
    assert.equal(typoBudget(7), 1);
    assert.equal(typoBudget(8), 2);
  });
});

describe("matchesEnglish — layer 3, typo tolerance", () => {
  test("intended near-misses pass", () => {
    assert.equal(matchesEnglish("ting", ["thing"]), true);
    assert.equal(matchesEnglish("teacer", ["teacher"]), true);
    assert.equal(matchesEnglish("expencive", ["expensive"]), true);
  });
  test("short different words do NOT pass — exact required at ≤3", () => {
    assert.equal(matchesEnglish("cat", ["car"]), false);
    assert.equal(matchesEnglish("car", ["cat"]), false);
    assert.equal(matchesEnglish("one", ["two"]), false);
    assert.equal(matchesEnglish("two", ["one"]), false);
  });
  test("a stripped gloss is the typo target too", () => {
    // "teacer" is one edit from "teacher" after the note comes off.
    assert.equal(matchesEnglish("teacer", ["teacher (of a school)"]), true);
  });
});

describe("synonymKeyOf — what reduces cleanly for the curated pool", () => {
  test("a bare word keys in, lowercased", () => {
    assert.equal(synonymKeyOf("Nonexistent"), "nonexistent");
  });
  test("a bare infinitive strips its leading 'to '", () => {
    assert.equal(synonymKeyOf("to eat"), "eat");
  });
  test("a hyphenated compound keys in whole", () => {
    assert.equal(synonymKeyOf("well-known"), "well-known");
  });
  test("anything left multi-word, punctuated, or with a digit is skipped", () => {
    assert.equal(synonymKeyOf("not being (there)"), null);
    assert.equal(synonymKeyOf("line, row, verse"), null);
    assert.equal(synonymKeyOf("four (4)"), null);
    assert.equal(synonymKeyOf(""), null);
  });
});

describe("matchesEnglish — layer 0.5, curated synonym pool (SAK-53)", () => {
  test("the original reported case: ない's own gloss is exact-matched more forgivingly", () => {
    // The bug this ticket fixes: ない's glosses are "nonexistent, not being
    // (there)"; typing the paraphrase "doesn't exist" was marked wrong.
    assert.equal(
      matchesEnglish("doesn't exist", ["nonexistent", "not being (there)"]),
      true,
    );
    assert.equal(
      matchesEnglish("does not exist", ["nonexistent", "not being (there)"]),
      true,
    );
  });
  test("slang register variants of high-frequency 'yes' glosses are accepted", () => {
    // Sam's second reported case: "yas" for うん isn't a typo (typoBudget is
    // 0 at this length by design) — it's a genuine informal register variant,
    // hand-seeded because WordNet (rel_syn=yes) has no entry for it at all.
    assert.equal(matchesEnglish("yas", ["yes"]), true);
    assert.equal(matchesEnglish("yas", ["yeah"]), true);
  });
  test("an unrelated word is still rejected even though the pool has entries", () => {
    assert.equal(matchesEnglish("banana", ["nonexistent", "not being (there)"]), false);
  });
  test("the pool layer is EXACT-ONLY — a typo of a pool entry is not forgiven", () => {
    // "doesnt exist" is one edit (the dropped apostrophe) from the pool entry
    // "doesn't exist" — close enough that a MERGED pool would let the typo
    // layer wave it through. It must not: the pool is checked exact-only, and
    // "doesnt exist" is also far (by edit distance) from the real gloss
    // "nonexistent" itself, so layer 3 cannot rescue it either. This is what
    // proves the "no compounding" design actually holds, not just that the
    // pool exists.
    assert.equal(matchesEnglish("doesnt exist", ["nonexistent"]), false);
  });
});

describe("synonymCandidates — assembled from the same fragments as layer 2", () => {
  test("draws from the whole gloss, its paren-stripped form, and comma pieces", () => {
    const c = synonymCandidates(["nonexistent, not being (there)"]);
    assert.ok(c.has("doesn't exist"));
    assert.ok(c.has("does not exist"));
  });
  test("a fact with no queryable single-word gloss yields an empty pool", () => {
    const c = synonymCandidates(["a very specific multi word gloss"]);
    assert.equal(c.size, 0);
  });
});

describe("matchesEnglish — never regresses exact / all-glosses", () => {
  test("exact match against any of several answers still passes", () => {
    const glosses = ["teacher", "instructor", "master"];
    assert.equal(matchesEnglish("teacher", glosses), true);
    assert.equal(matchesEnglish("INSTRUCTOR", glosses), true);
    assert.equal(matchesEnglish("  master ", glosses), true);
  });
  test("case and collapsed whitespace are forgiven, as before", () => {
    assert.equal(matchesEnglish("One  Thing", ["one thing"]), true);
  });
  test("empty answer never matches", () => {
    assert.equal(matchesEnglish("", ["teacher"]), false);
  });
});

describe("English-only — Japanese readings are not loosened", () => {
  test("isEnglishGloss is false for kana, true for a Latin-bearing gloss", () => {
    assert.equal(isEnglishGloss("せんせい"), false);
    assert.equal(isEnglishGloss("ten long thin objects, also じっぽん"), true);
  });
  test("a kana reading answer keeps exact-match — no typo tolerance", () => {
    // せんせい is 4 chars; a length-4 typo budget of 1 would wrongly accept a
    // one-edit near-miss if the layers ran on Japanese. They must not.
    assert.equal(matchesEnglish("せんせい", ["せんせい"]), true);
    assert.equal(matchesEnglish("せんせえ", ["せんせい"]), false);
  });
  test("norm helper collapses space and case", () => {
    assert.equal(norm("  A  B "), "a b");
  });
});

describe("glossCandidates — the assembled pool for one gloss", () => {
  test("full, stripped, pieces and digit variants are all present", () => {
    const c = glossCandidates("ten long thin objects, also じっぽん");
    for (const want of [
      "ten long thin objects, also じっぽん",
      "ten long thin objects",
      "10",
      "also じっぽん",
    ]) {
      assert.ok(c.has(norm(want)), want);
    }
  });
});

// Wiring: the same forgiveness reaches a real fact through the drill's front
// door (checkTyped → questionsFor.check → checkJp2en → accepts).
describe("wired into checkTyped for real kanji facts", () => {
  test("a kanji MEANING accepts every gloss, a typo of one, but not an unrelated word", () => {
    // 生 glosses: ["life","genuine","birth"].
    const sei = meaningFactId("生");
    assert.equal(checkTyped(sei, "life", "jp2en"), true); // exact
    assert.equal(checkTyped(sei, "genuine", "jp2en"), true); // another gloss
    assert.equal(checkTyped(sei, "liife", "jp2en"), true); // one insertion in "life"
    assert.equal(checkTyped(sei, "dog", "jp2en"), false); // unrelated, far from all
  });
  test("a kanji READING (kana answer) is untouched by the English layers", () => {
    // 一 read いち in 一 on its own. Romaji is graded elsewhere; the kana answer
    // must not gain typo tolerance.
    const ichi = readingFactId("一", "一");
    assert.equal(checkTyped(ichi, "いち", "jp2en"), true);
    assert.equal(checkTyped(ichi, "いし", "jp2en"), false);
  });
  test("SAK-53's literal repro case, through the real ない fact end-to-end", () => {
    // Not a hand-typed gloss fixture: this is the actual VOCAB row for ない,
    // its real fact id, and the real generated en-synonyms.json loaded by
    // en-match.ts at import time. ない's live glosses are exactly
    // ["nonexistent", "not being (there)"] — confirmed by reading VOCAB
    // directly while writing this test. If the generated pool ever stops
    // carrying the "nonexistent" → "doesn't exist" entry, this fails, unlike
    // the hand-fixture tests above which would keep passing regardless.
    const nai = wordMeaningFactId("ない");
    assert.equal(checkTyped(nai, "doesn't exist", "jp2en"), true);
    assert.equal(checkTyped(nai, "does not exist", "jp2en"), true);
    assert.equal(checkTyped(nai, "nonexistent", "jp2en"), true); // unchanged exact match
    assert.equal(checkTyped(nai, "delicious", "jp2en"), false); // unrelated, still rejected
  });
});

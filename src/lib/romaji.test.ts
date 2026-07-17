// Run: node --import ./src/lib/conjugate/test-hooks.mjs --test src/lib/romaji.test.ts
//
// The converter is the load-bearing part of romaji input: if it turns "sensei"
// into anything but せんせい, a correct answer grades wrong. These pin the
// behaviours a romaji typist actually relies on — the alternate romanizations,
// ん in its several spellings, っ from a doubled consonant, the combos, and the
// script/passthrough rules the grader leans on — as CLAIMS, not as a restated
// table.

import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { isKanaOnly, romajiMatches, toHiragana, toKana } from "./romaji.ts";

describe("toKana — base kana and vowels", () => {
  test("plain syllables", () => {
    assert.equal(toKana("ka"), "か");
    assert.equal(toKana("a"), "あ");
    assert.equal(toKana("konnichiha"), "こんにちは");
  });

  test("voiced (dakuten) and handakuten", () => {
    assert.equal(toKana("ga"), "が");
    assert.equal(toKana("za"), "ざ");
    assert.equal(toKana("pa"), "ぱ");
    assert.equal(toKana("bu"), "ぶ");
  });
});

describe("toKana — alternate romanizations", () => {
  test("shi/si, tsu/tu, chi/ti, fu/hu all reach the same kana", () => {
    assert.equal(toKana("shi"), "し");
    assert.equal(toKana("si"), "し");
    assert.equal(toKana("tsu"), "つ");
    assert.equal(toKana("tu"), "つ");
    assert.equal(toKana("chi"), "ち");
    assert.equal(toKana("ti"), "ち");
    assert.equal(toKana("fu"), "ふ");
    assert.equal(toKana("hu"), "ふ");
  });

  test("wo, and o is お not を", () => {
    assert.equal(toKana("wo"), "を");
    assert.equal(toKana("o"), "お");
  });

  test("zu is ず and ji is じ (the plain row wins the collision)", () => {
    assert.equal(toKana("zu"), "ず");
    assert.equal(toKana("ji"), "じ");
    // du/di stay the only route to the d-row kana.
    assert.equal(toKana("du"), "づ");
    assert.equal(toKana("di"), "ぢ");
  });
});

describe("toKana — combos (youon)", () => {
  test("kya, sha and its variants, cha, ja", () => {
    assert.equal(toKana("kya"), "きゃ");
    assert.equal(toKana("sha"), "しゃ");
    assert.equal(toKana("sya"), "しゃ");
    assert.equal(toKana("cha"), "ちゃ");
    assert.equal(toKana("tya"), "ちゃ");
    assert.equal(toKana("ja"), "じゃ");
    assert.equal(toKana("jyu"), "じゅ");
    assert.equal(toKana("ryo"), "りょ");
  });

  test("combo beats the base kana it starts with", () => {
    // ki + ya would be きや; the longest match must pick きゃ.
    assert.equal(toKana("kya"), "きゃ");
    assert.notEqual(toKana("kya"), "きや");
  });
});

describe("toKana — ん in all its spellings", () => {
  test("n before a consonant", () => {
    assert.equal(toKana("sensei"), "せんせい");
    assert.equal(toKana("kanji"), "かんじ");
  });

  test("n + vowel or n + y is a な-row / にゃ syllable, not ん", () => {
    assert.equal(toKana("na"), "な");
    assert.equal(toKana("nya"), "にゃ");
    assert.equal(toKana("tanuki"), "たぬき");
  });

  test("nn and n' force ん", () => {
    assert.equal(toKana("nn"), "ん");
    assert.equal(toKana("kanpai"), "かんぱい");
    // apostrophe disambiguates ん from a な-row syllable: hon'ya vs honya.
    assert.equal(toKana("hon'ya"), "ほんや");
    assert.equal(toKana("honya"), "ほにゃ");
  });

  test("nna is ん + な, not んあ", () => {
    assert.equal(toKana("konna"), "こんな");
  });

  test("trailing n resolves to ん when finalized", () => {
    assert.equal(toKana("san"), "さん");
    assert.equal(toKana("n"), "ん");
  });
});

describe("toKana — っ gemination", () => {
  test("doubled consonant becomes small tsu", () => {
    assert.equal(toKana("kitto"), "きっと");
    assert.equal(toKana("kekkon"), "けっこん");
    assert.equal(toKana("zasshi"), "ざっし");
  });

  test("tch is っ + ち-row", () => {
    assert.equal(toKana("matcha"), "まっちゃ");
  });
});

describe("toKana — katakana target", () => {
  test("same rules, katakana output", () => {
    assert.equal(toKana("terebi", { katakana: true }), "テレビ");
    // A repeated vowel stays literal; only a hyphen makes the ー long mark.
    assert.equal(toKana("koohii", { katakana: true }), "コオヒイ");
    assert.equal(toKana("ko-hi-", { katakana: true }), "コーヒー");
  });

  test("gemination and ん in katakana", () => {
    assert.equal(toKana("kitto", { katakana: true }), "キット");
    assert.equal(toKana("pan", { katakana: true }), "パン");
  });
});

describe("toKana — live (as-you-type) mode", () => {
  test("resolved kana forms; the incomplete tail stays latin", () => {
    assert.equal(toKana("sens", { live: true }), "せんs");
    assert.equal(toKana("sensei", { live: true }), "せんせい");
    // "ky" is an incomplete combo (needs kya/kyu/kyo) with no き in it — it
    // stays latin until the vowel lands.
    assert.equal(toKana("ky", { live: true }), "ky");
    assert.equal(toKana("kyo", { live: true }), "きょ");
  });

  test("a lone trailing n stays pending so na can still form", () => {
    assert.equal(toKana("kan", { live: true }), "かn");
    assert.equal(toKana("kana", { live: true }), "かな");
  });

  test("idempotent on its own output (kana passes through)", () => {
    const once = toKana("kore", { live: true });
    assert.equal(once, "これ");
    assert.equal(toKana(once + "na", { live: true }), "これな");
  });
});

describe("toKana — x/l small-kana escapes", () => {
  test("standalone small kana", () => {
    assert.equal(toKana("xtsu"), "っ");
    assert.equal(toKana("xya"), "ゃ");
    assert.equal(toKana("la"), "ぁ");
  });
});

describe("passthrough and script helpers", () => {
  test("kana and kanji pass through toKana untouched", () => {
    assert.equal(toKana("これ"), "これ");
    assert.equal(toKana("先生"), "先生");
  });

  test("toHiragana folds katakana, leaves the rest", () => {
    assert.equal(toHiragana("コレ"), "これ");
    assert.equal(toHiragana("これ"), "これ");
    assert.equal(toHiragana("先生"), "先生");
  });

  test("isKanaOnly is true for kana, false for kanji and empty", () => {
    assert.equal(isKanaOnly("これ"), true);
    assert.equal(isKanaOnly("コーヒー"), true);
    assert.equal(isKanaOnly("せんせい"), true);
    assert.equal(isKanaOnly("先生"), false);
    assert.equal(isKanaOnly("生"), false);
    assert.equal(isKanaOnly(""), false);
    assert.equal(isKanaOnly("kore"), false);
  });
});

describe("romajiMatches — the grader's one call", () => {
  test("romaji matches a kana target", () => {
    assert.equal(romajiMatches("kore", "これ"), true);
    assert.equal(romajiMatches("sensei", "せんせい"), true);
    assert.equal(romajiMatches("totemo", "とても"), true);
  });

  test("raw kana (IME user) matches by the same path", () => {
    assert.equal(romajiMatches("これ", "これ"), true);
  });

  test("script-agnostic: hiragana romaji matches a katakana answer", () => {
    assert.equal(romajiMatches("terebi", "テレビ"), true);
    assert.equal(romajiMatches("ko-hi-", "コーヒー"), true);
  });

  test("trailing-n answers finalize before comparison", () => {
    assert.equal(romajiMatches("san", "さん"), true);
  });

  test("romaji cannot match a kanji answer", () => {
    assert.equal(romajiMatches("sei", "生"), false);
    assert.equal(romajiMatches("sensei", "先生"), false);
  });

  test("a wrong reading does not match", () => {
    assert.equal(romajiMatches("kore", "それ"), false);
  });
});

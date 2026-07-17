// Run: node --import ../conjugate/test-hooks.mjs --test src/lib/engine/romaji-check.test.ts
//
// The grader's en2jp path, end to end: does checkTyped accept a ROMAJI answer
// for a kana glyph, keep accepting the raw kana an IME user types, and still
// refuse romaji for a kanji answer (which has no romaji)? These are claims
// about checkEn2jp reached through the same public seam the drill uses.

import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { kanaFact } from "../../data/characters.ts";
import { wordMeaningFactId, wordReadingFactId } from "../../data/vocab.ts";
import { readingFactId } from "../../data/kanji.ts";
import { checkTyped } from "./index.ts";

describe("en2jp check — kana glyphs accept romaji", () => {
  test("a kana character accepts its romaji and its kana", () => {
    const ka = kanaFact("か");
    assert.equal(checkTyped(ka, "ka", "en2jp"), true); // romaji
    assert.equal(checkTyped(ka, "か", "en2jp"), true); // raw kana (IME)
    assert.equal(checkTyped(ka, "ki", "en2jp"), false); // wrong
  });

  test("a kana word accepts romaji, raw kana, and rejects the wrong reading", () => {
    // これ is a kana word: keb === reb, so its meaning fact's glyph is これ.
    const kore = wordMeaningFactId("これ");
    assert.equal(checkTyped(kore, "kore", "en2jp"), true);
    assert.equal(checkTyped(kore, "これ", "en2jp"), true);
    assert.equal(checkTyped(kore, "sore", "en2jp"), false);
  });
});

describe("en2jp check — kanji glyphs never accept romaji", () => {
  test("a kanji word reading is exact-match only", () => {
    // 先生 is a kanji word (keb 先生 ≠ reb せんせい). Its answer glyph is the
    // kanji, which no romaji can spell — only the kanji itself grades.
    const sensei = wordReadingFactId("先生");
    assert.equal(checkTyped(sensei, "sensei", "en2jp"), false);
    assert.equal(checkTyped(sensei, "せんせい", "en2jp"), false); // the reading, not the glyph
    assert.equal(checkTyped(sensei, "先生", "en2jp"), true);
  });

  test("a single-kanji reading fact is exact-match only", () => {
    const sei = readingFactId("生", "人生");
    assert.equal(checkTyped(sei, "sei", "en2jp"), false);
    assert.equal(checkTyped(sei, "生", "en2jp"), true);
  });
});

describe("jp2en check is unchanged", () => {
  test("kana still graded against its romaji answers", () => {
    const shi = kanaFact("し");
    assert.equal(checkTyped(shi, "shi", "jp2en"), true);
    assert.equal(checkTyped(shi, "si", "jp2en"), true);
    assert.equal(checkTyped(shi, "chi", "jp2en"), false);
  });
});

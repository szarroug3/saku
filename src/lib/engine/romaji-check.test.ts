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
import { meaningFactId, readingFactId } from "../../data/kanji.ts";
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

describe("en2jp check — a word reading is answered by its kana", () => {
  test("a kanji word's reading fact grades the kana READING, not the glyph", () => {
    // 先生 is a kanji word (keb 先生 ≠ reb せんせい). En→jp on its READING fact
    // is the typed gap: shown the gloss, the learner produces the reading せんせい,
    // which romaji CAN spell — so romaji and raw kana both grade, and the kanji
    // glyph (a different question — "write the word") does not.
    const sensei = wordReadingFactId("先生");
    assert.equal(checkTyped(sensei, "sensei", "en2jp"), true); // romaji, no IME
    assert.equal(checkTyped(sensei, "せんせい", "en2jp"), true); // the reading
    assert.equal(checkTyped(sensei, "先生", "en2jp"), false); // the glyph is not the reading
    assert.equal(checkTyped(sensei, "gakusei", "en2jp"), false); // wrong reading
  });
});

describe("en2jp check — kanji glyphs never accept romaji", () => {
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

describe("jp2en check — an all-kana ANSWER accepts romaji too", () => {
  // The mirror of the en2jp rule above, and it was missing. A reading question
  // shows the kanji and wants its reading; the reading is all kana, so the
  // learner with no IME can only type romaji, and it has to grade.
  test("a kanji reading fact accepts the romaji spelling of its reading", () => {
    const sei = readingFactId("生", "人生");
    assert.equal(checkTyped(sei, "sei", "jp2en"), true); // romaji, no IME
    assert.equal(checkTyped(sei, "せい", "jp2en"), true); // the kana itself
    assert.equal(checkTyped(sei, "shou", "jp2en"), false); // another reading of 生
  });

  test("a word reading fact accepts the romaji spelling of its reading", () => {
    const sensei = wordReadingFactId("先生");
    assert.equal(checkTyped(sensei, "sensei", "jp2en"), true);
    assert.equal(checkTyped(sensei, "せんせい", "jp2en"), true);
    assert.equal(checkTyped(sensei, "gakusei", "jp2en"), false);
  });
});

describe("jp2en check — ENGLISH meaning answers are untouched", () => {
  // The forgiveness is keyed on the ANSWER being all kana. A meaning answer is
  // English, so nothing about it changes — least of all accepting the reading.
  test("a kanji meaning fact still wants the English", () => {
    const life = meaningFactId("生");
    assert.equal(checkTyped(life, "life", "jp2en"), true);
    assert.equal(checkTyped(life, "sei", "jp2en"), false); // the reading is not the meaning
    assert.equal(checkTyped(life, "せい", "jp2en"), false);
  });

  test("a word meaning fact still wants the English", () => {
    const teacher = wordMeaningFactId("先生");
    assert.equal(checkTyped(teacher, "teacher", "jp2en"), true);
    assert.equal(checkTyped(teacher, "sensei", "jp2en"), false);
    assert.equal(checkTyped(teacher, "せんせい", "jp2en"), false);
  });
});

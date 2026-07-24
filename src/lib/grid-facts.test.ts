import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { kanaFact } from "@/data/characters";
import { meaningFactId, READING_INDEX } from "@/data/kanji";
import { VOCAB, wordMeaningFactId, wordReadingFactId } from "@/data/vocab";
import { gridFacts } from "@/lib/grid-facts";

const word = VOCAB[0];
const definition = wordMeaningFactId(word.keb);
const wordReading = wordReadingFactId(word.keb);
const kanjiMeaning = meaningFactId("生");
const kanjiReading = [...READING_INDEX.keys()][0];
const kanaReading = kanaFact("あ");
const facts = [
  definition,
  wordReading,
  kanjiMeaning,
  kanjiReading,
  kanaReading,
];

describe("Grid response types", () => {
  test("English keeps definitions plus kana romanization", () => {
    assert.deepEqual(
      gridFacts(facts, ["definition"]),
      [definition, kanjiMeaning, kanaReading],
    );
  });

  test("Kanji reading keeps only kanji-bearing reading facts", () => {
    assert.deepEqual(
      gridFacts(facts, ["romaji"]),
      [wordReading, kanjiReading],
    );
  });

  test("both response types cover definitions, kanji readings, and kana", () => {
    assert.deepEqual(gridFacts(facts, ["definition", "romaji"]), facts);
  });

  test("a hiragana-only selection produces Grid cards through English", () => {
    const hiragana = ["あ", "い", "う", "え"].map(kanaFact);
    assert.deepEqual(gridFacts(hiragana, ["definition"]), hiragana);
  });

  test("an empty response selection deals no cards", () => {
    assert.deepEqual(gridFacts(facts, []), []);
  });
});

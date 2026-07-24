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
  test("Definition keeps only facts answered with a definition", () => {
    assert.deepEqual(
      gridFacts(facts, ["definition"]),
      [definition, kanjiMeaning],
    );
  });

  test("Reading keeps word, kanji, and kana reading facts", () => {
    assert.deepEqual(
      gridFacts(facts, ["romaji"]),
      [wordReading, kanjiReading, kanaReading],
    );
  });

  test("both response types preserve the selected fact order", () => {
    assert.deepEqual(gridFacts(facts, ["definition", "romaji"]), facts);
  });

  test("an empty response selection deals no cards", () => {
    assert.deepEqual(gridFacts(facts, []), []);
  });
});

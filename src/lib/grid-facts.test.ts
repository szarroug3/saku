import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { kanaFact } from "@/data/characters";
import { meaningFactId, READING_INDEX } from "@/data/kanji";
import { VOCAB, wordMeaningFactId, wordReadingFactId } from "@/data/vocab";
import { factInfo } from "@/lib/facts";
import { gridBoards, gridFacts } from "@/lib/grid-facts";

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

describe("Grid headed boards (task #33)", () => {
  const kanjiMeaning = meaningFactId("生");
  const kanjiReading = [...READING_INDEX.keys()][0];
  const wordMeaning = definition;
  const wReading = wordReading;
  const kana = kanaReading;
  const span = [wordMeaning, wReading, kanjiMeaning, kanjiReading, kana];

  test("a selection spanning kanji+words and definition+romaji splits into homogeneous headed boards", () => {
    const boards = gridBoards(span, ["definition", "romaji"]);
    // Teaching order of source (kana, kanji, word), then response.
    assert.deepEqual(
      boards.map((b) => [b.header, b.facts]),
      [
        ["Kana → Romaji", [kana]],
        ["Kanji → Meaning", [kanjiMeaning]],
        ["Kanji → Reading", [kanjiReading]],
        ["Words → Meaning", [wordMeaning]],
        ["Words → Reading", [wReading]],
      ],
    );
    // No board mixes source types, and each carries a single response.
    for (const b of boards) {
      assert.equal(new Set(b.facts.map((f) => factInfo(f)!.subject)).size, 1);
      assert.ok(["meaning", "reading", "romaji"].includes(b.response));
    }
  });

  test("empty groups are absent", () => {
    assert.deepEqual(
      gridBoards(span, ["romaji"]).map((b) => b.header),
      ["Kanji → Reading", "Words → Reading"],
    );
    assert.deepEqual(gridBoards(span, ["definition"]).map((b) => b.header), [
      "Kana → Romaji",
      "Kanji → Meaning",
      "Words → Meaning",
    ]);
    assert.deepEqual(gridBoards([], ["definition", "romaji"]), []);
  });

  test("the 愛 word/kanji collision lands in two boards with distinct headers", () => {
    const kanji = meaningFactId("愛");
    const wordish = wordMeaningFactId("愛");
    const boards = gridBoards([kanji, wordish], ["definition"]);
    assert.deepEqual(
      boards.map((b) => [b.header, b.facts]),
      [
        ["Kanji → Meaning", [kanji]],
        ["Words → Meaning", [wordish]],
      ],
    );
    assert.notEqual(boards[0].header, boards[1].header);
  });
});

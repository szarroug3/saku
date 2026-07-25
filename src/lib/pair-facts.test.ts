import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { kanaFact } from "@/data/characters";
import { patternMeaningFactId } from "@/data/grammar";
import { CORPUS } from "@/data/grammar/corpus";
import { meaningFactId, READING_INDEX } from "@/data/kanji";
import {
  VOCAB,
  isKanaWord,
  wordMeaningFactId,
  wordReadingFactId,
} from "@/data/vocab";
import { factInfo } from "@/lib/facts";
import { pairBoards, pairFacts, pairSpecs } from "@/lib/pair-facts";
import type { HistoryFile } from "@/types";

const T = 1_700_000_000_000;
const ALL_KNOWN: HistoryFile = {
  sessions: [],
  facts: {},
  claims: Object.fromEntries(VOCAB.map((w) => [wordMeaningFactId(w.keb), T])),
};
const EMPTY: HistoryFile = { sessions: [], facts: {} };

const kanjiWord = VOCAB.find((w) => !isKanaWord(w))!;
const kanaWord = VOCAB.find((w) => isKanaWord(w))!;
const wordMeaning = wordMeaningFactId(kanjiWord.keb);
const wordReading = wordReadingFactId(kanjiWord.keb);
const kanjiReading = [...READING_INDEX.keys()][0];

describe("Match-pairs relationships", () => {
  test("Japanese + English uses definitions and kana romanization", () => {
    const specs = pairSpecs(
      [
        kanaFact("あ"),
        wordMeaning,
        wordMeaningFactId(kanaWord.keb),
        meaningFactId("生"),
      ],
      ["definition"],
      EMPTY,
    );
    assert.equal(specs.length, 4);
    assert.ok(specs.every((p) => p.kind === "definition"));
    assert.ok(specs.every((p) => p.japanese && p.answer));
    assert.ok(specs.some((p) => p.japanese === "あ" && p.answer === "a"));
  });

  test("a hiragana-only selection produces a real matching board", () => {
    const hiragana = ["あ", "い", "う", "え"].map(kanaFact);
    const specs = pairSpecs(hiragana, ["definition"], EMPTY);
    assert.equal(specs.length, hiragana.length);
    assert.deepEqual(
      specs.map((p) => p.answer),
      ["a", "i", "u", "e"],
    );
  });

  test("Romaji pairs require kanji-bearing Japanese", () => {
    const specs = pairSpecs(
      [kanaFact("あ"), wordMeaningFactId(kanaWord.keb), wordReading, kanjiReading],
      ["romaji"],
      EMPTY,
    );
    assert.deepEqual(
      new Set(specs.map((p) => p.fact)),
      new Set([wordReading, kanjiReading]),
    );
    assert.ok(specs.every((p) => /\p{Script=Han}/u.test(p.japanese)));
  });

  test("a kana-only word is never paired with its romaji", () => {
    assert.deepEqual(
      pairSpecs(
        [wordMeaningFactId(kanaWord.keb), wordReadingFactId(kanaWord.keb)],
        ["romaji"],
        EMPTY,
      ),
      [],
    );
  });

  test("Sentence pairs reuse readable Japanese + English corpus translations", () => {
    const ex = CORPUS.find((row) => row.p.length > 0)!;
    const facts = ex.p.map(patternMeaningFactId);
    const specs = pairSpecs(facts, ["sentence"], ALL_KNOWN);
    assert.ok(specs.length > 0);
    assert.ok(specs.every((p) => p.kind === "sentence"));
    assert.ok(specs.every((p) => p.japanese && p.answer));
    assert.ok(specs.every((p) => facts.includes(p.fact)));
  });

  test("Sentence pairs stay gated when the learner cannot read the corpus", () => {
    const facts = CORPUS[0].p.map(patternMeaningFactId);
    assert.deepEqual(pairSpecs(facts, ["sentence"], EMPTY), []);
  });

  test("the menu selection strictly controls which variants are emitted", () => {
    const fact = wordMeaning;
    assert.deepEqual(pairSpecs([fact], ["romaji"], EMPTY), []);
    assert.deepEqual(
      pairSpecs([fact], ["definition"], EMPTY).map((p) => p.kind),
      ["definition"],
    );
  });

  test("pairFacts dedupes facts even when several variants credit one", () => {
    const grammarFacts = CORPUS.flatMap((ex) => ex.p.map(patternMeaningFactId));
    const fact = grammarFacts.find(
      (f) =>
        pairSpecs([f], ["definition"], ALL_KNOWN).length > 0 &&
        pairSpecs([f], ["sentence"], ALL_KNOWN).length > 0,
    )!;
    assert.deepEqual(
      pairFacts([fact, fact], ["definition", "sentence"], ALL_KNOWN),
      [fact],
    );
  });

  test("no matching board has duplicate visible destinations", () => {
    const facts = [
      ...VOCAB.flatMap((w) => [
        wordMeaningFactId(w.keb),
        wordReadingFactId(w.keb),
      ]),
      ...CORPUS.flatMap((ex) => ex.p.map(patternMeaningFactId)),
    ];
    // The dedup guard is PER BOARD: within a single headed board no two cells
    // share a visible Japanese-side identity or a visible answer. Across boards
    // a glyph legitimately repeats (電話 on "Words → meaning" and on
    // "Words → reading"), so uniqueness is asserted per board, not globally.
    for (const board of pairBoards(
      facts,
      ["definition", "romaji", "sentence"],
      ALL_KNOWN,
    )) {
      const left = board.specs.map((p) => `${p.japanese}\u0000${p.context ?? ""}`);
      const right = board.specs.map((p) => p.answer.trim().toLowerCase());
      assert.equal(new Set(left).size, left.length);
      assert.equal(new Set(right).size, right.length);
    }
  });
});

describe("Match-pairs headed boards (task #33)", () => {
  test("a selection spanning kanji+words and two responses splits into homogeneous headed boards", () => {
    const boards = pairBoards(
      [wordMeaning, wordReading, meaningFactId("生"), kanjiReading],
      ["definition", "romaji"],
      EMPTY,
    );
    for (const b of boards) {
      assert.equal(new Set(b.specs.map((s) => factInfo(s.fact)!.subject)).size, 1);
      assert.ok(b.specs.every((s) => s.header === b.header));
    }
    assert.deepEqual(
      boards.map((b) => b.header),
      ["Kanji → meaning", "Kanji → reading", "Words → meaning", "Words → reading"],
    );
    // wordMeaning (a definition) and wordReading (a romaji) of ONE word land on
    // two different boards — the disambiguation task #30 opened.
    const meaningBoard = boards.find((b) => b.header === "Words → meaning")!;
    const readingBoard = boards.find((b) => b.header === "Words → reading")!;
    assert.ok(meaningBoard.specs.some((s) => s.fact === wordMeaning));
    assert.ok(readingBoard.specs.some((s) => s.fact === wordReading));
  });

  test("the 愛 word/kanji collision lands on two boards with distinct headers, both kept", () => {
    const kanji = meaningFactId("愛");
    const wordish = wordMeaningFactId("愛");
    const boards = pairBoards([kanji, wordish], ["definition"], EMPTY);
    assert.deepEqual(
      boards.map((b) => [b.header, b.specs.map((s) => s.fact)]),
      [
        ["Kanji → meaning", [kanji]],
        ["Words → meaning", [wordish]],
      ],
    );
    // Both survive though their answers collide — the old GLOBAL dedup silently
    // dropped one; per-board dedup keeps both, headed apart.
    assert.notEqual(boards[0].header, boards[1].header);
  });

  test("a sentence board is headed and homogeneous", () => {
    const ex = CORPUS.find((row) => row.p.length > 0)!;
    const facts = ex.p.map(patternMeaningFactId);
    const boards = pairBoards(facts, ["sentence"], ALL_KNOWN);
    assert.ok(boards.length > 0);
    assert.ok(boards.every((b) => b.header === "Sentences → meaning"));
    assert.ok(boards.every((b) => b.specs.every((s) => s.kind === "sentence")));
  });
});

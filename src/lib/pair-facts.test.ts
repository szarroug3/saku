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
import {
  dropClippedTail,
  pairBoards,
  pairFacts,
  pairSpecs,
  playablePairBoards,
  type PairSpec,
} from "@/lib/pair-facts";
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
    // a glyph legitimately repeats (電話 on "Words ↔ Meaning" and on
    // "Words ↔ Reading"), so uniqueness is asserted per board, not globally.
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
      ["Kanji ↔ Meaning", "Kanji ↔ Reading", "Words ↔ Meaning", "Words ↔ Reading"],
    );
    // wordMeaning (a definition) and wordReading (a romaji) of ONE word land on
    // two different boards — the disambiguation task #30 opened.
    const meaningBoard = boards.find((b) => b.header === "Words ↔ Meaning")!;
    const readingBoard = boards.find((b) => b.header === "Words ↔ Reading")!;
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
        ["Kanji ↔ Meaning", [kanji]],
        ["Words ↔ Meaning", [wordish]],
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
    assert.ok(boards.every((b) => b.header === "Sentences ↔ Meaning"));
    assert.ok(boards.every((b) => b.specs.every((s) => s.kind === "sentence")));
  });
});

describe("Match-pairs playable boards (≥2-pair invariant)", () => {
  const kanjiA = meaningFactId("生");
  const kanjiB = meaningFactId("愛");

  test("a lone-pair board is grouped by pairBoards but dropped by playable", () => {
    // The grouping is honest — a single kanji still HAS its Kanji ↔ Meaning board —
    assert.equal(pairBoards([kanjiA], ["definition"], EMPTY).length, 1);
    // — but one pair is not a matching game, so it is never dealable.
    assert.deepEqual(playablePairBoards([kanjiA], ["definition"], EMPTY), []);
  });

  test("a board with two or more pairs is kept", () => {
    const boards = playablePairBoards([kanjiA, kanjiB], ["definition"], EMPTY);
    assert.equal(boards.length, 1);
    assert.equal(boards[0].header, "Kanji ↔ Meaning");
    assert.equal(boards[0].specs.length, 2);
  });

  test("a mixed selection keeps the ≥2 board and drops the lone one", () => {
    // 生 + 愛 fill one Kanji ↔ Meaning board (two pairs); あ is a lone
    // Kana ↔ Romaji pair, and only the full board survives.
    const boards = playablePairBoards(
      [kanjiA, kanjiB, kanaFact("あ")],
      ["definition"],
      EMPTY,
    );
    assert.deepEqual(
      boards.map((b) => b.header),
      ["Kanji ↔ Meaning"],
    );
  });

  test("when every type is a lone pair there is no playable board", () => {
    // One kanji (Kanji ↔ Meaning) and one kana (Kana ↔ Romaji): two grouped
    // boards, each a single pair, so nothing is dealable — the all-empty case
    // Start must gate rather than launch into a blank run.
    const facts = [kanjiA, kanaFact("あ")];
    assert.equal(pairBoards(facts, ["definition"], EMPTY).length, 2);
    assert.deepEqual(playablePairBoards(facts, ["definition"], EMPTY), []);
  });
});

describe("dropClippedTail — Count never leaves a lone tail pair", () => {
  const spec = (header: string, id: string): PairSpec =>
    ({
      id,
      fact: id,
      kind: "definition",
      japanese: id,
      answer: id,
      context: null,
      header,
    }) as unknown as PairSpec;

  test("drops a trailing board the count-slice clipped to one pair", () => {
    const deck = [spec("A", "a1"), spec("A", "a2"), spec("B", "b1")];
    assert.deepEqual(
      dropClippedTail(deck).map((s) => s.id),
      ["a1", "a2"],
    );
  });

  test("keeps the deck when the last board is whole", () => {
    const deck = [
      spec("A", "a1"),
      spec("A", "a2"),
      spec("B", "b1"),
      spec("B", "b2"),
    ];
    assert.deepEqual(
      dropClippedTail(deck).map((s) => s.id),
      ["a1", "a2", "b1", "b2"],
    );
  });

  test("an empty deck stays empty", () => {
    assert.deepEqual(dropClippedTail([]), []);
  });
});

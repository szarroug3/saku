// Run: node --import ./src/lib/conjugate/test-hooks.mjs --test \
//        src/lib/word-lesson.test.ts
//
// WHAT THESE TESTS ARE FOR
// ========================
// The words track's teaching order is beginnerRank and its boundary is a GATE,
// not a static cut: which word comes next depends on which kanji you know. The
// failure modes all type-check — a lesson that hands you a word before its
// kanji, a kana-only word that waits on kanji it doesn't contain, a curriculum
// that quietly drifts off beginnerRank order. So these pin the ORDER, the GATE,
// and the CUT over the real 12,553.

import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { meaningFactId as kanjiMeaningFactId } from "../data/kanji.ts";
import { VOCAB, wordMeaningFactId } from "../data/vocab.ts";
import {
  CURRICULUM_WORDS,
  WORDS_CURRICULUM_MAX,
  WORDS_CURRICULUM_TOTAL,
  WORDS_PER_LESSON_DEFAULT,
  clampWordsPerLesson,
  isKanaOnlyWord,
  nextWordLesson,
  topWordGate,
  wordKanji,
  wordTeachable,
} from "./word-lesson.ts";
import type { FactId, HistoryFile } from "../types/index.ts";

const AT = Date.UTC(2026, 0, 1);

function history(over: Partial<HistoryFile> = {}): HistoryFile {
  return { sessions: [], facts: {}, claims: {}, ...over };
}

/** Claim these facts known — the cheap way to move history forward, mirroring
 * /api/claim. A claim is non-fresh, so it satisfies both "kanji known" and
 * "word met". */
function claiming(facts: readonly FactId[]): HistoryFile {
  const claims: Record<string, number> = {};
  for (const f of facts) claims[f] = AT;
  return history({ claims: claims as HistoryFile["claims"] });
}

/** Every kanji meaning fact — "I finished the kanji track". */
function allKanjiFacts(): FactId[] {
  const chars = new Set<string>();
  for (const w of CURRICULUM_WORDS) for (const c of wordKanji(w.keb)) chars.add(c);
  return [...chars].map(kanjiMeaningFactId);
}

function allKanjiKnown(): HistoryFile {
  return claiming(allKanjiFacts());
}

describe("the curriculum is the JLPT core, in beginnerRank order", () => {
  test("cut at WORDS_CURRICULUM_MAX, nothing above it", () => {
    assert.ok(CURRICULUM_WORDS.length > 5000 && CURRICULUM_WORDS.length <= 6300);
    for (const w of CURRICULUM_WORDS) {
      assert.ok(w.beginnerRank <= WORDS_CURRICULUM_MAX);
    }
    // It is a strict prefix of the rank order: every word at or below the cut is
    // in, every word above is out.
    const inCore = VOCAB.filter((w) => w.beginnerRank <= WORDS_CURRICULUM_MAX);
    assert.equal(CURRICULUM_WORDS.length, inCore.length);
  });

  test("strictly ascending by beginnerRank — never reorders", () => {
    for (let i = 1; i < CURRICULUM_WORDS.length; i++) {
      assert.ok(
        CURRICULUM_WORDS[i].beginnerRank > CURRICULUM_WORDS[i - 1].beginnerRank,
      );
    }
  });

  test("a lesson's words arrive in beginnerRank order", () => {
    const lesson = nextWordLesson(allKanjiKnown(), 6)!;
    const ranks = lesson.cards.map(
      (c) => VOCAB.find((w) => w.keb === c.keb)!.beginnerRank,
    );
    assert.deepEqual(ranks, [...ranks].sort((a, b) => a - b));
    // With every kanji known nothing is gated, so the lesson is the literal head
    // of the order: 何 (rank 1) leads.
    assert.equal(lesson.cards[0].keb, "何");
  });
});

describe("kana-only words come first — the gate, not a re-sort", () => {
  test("with no kanji known, the lesson is all kana-only, though 何 outranks them", () => {
    const lesson = nextWordLesson(history(), 6)!;
    assert.ok(lesson.cards.length > 0);
    for (const card of lesson.cards) {
      assert.ok(card.kana, `${card.keb} should be kana-only`);
    }
    // 何 is rank 1 and would lead if it weren't gated — it is stepped over, not
    // reordered away. The first teachable word is the lowest-rank kana-only one.
    assert.notEqual(lesson.cards[0].keb, "何");
    assert.equal(lesson.cards[0].keb, "あなた");
  });

  test("a kana-only word is teachable with an empty history", () => {
    const anata = VOCAB.find((w) => w.keb === "あなた")!;
    assert.ok(isKanaOnlyWord(anata));
    assert.ok(wordTeachable(anata, history()));
  });
});

describe("a kanji word gates on knowing EVERY one of its kanji", () => {
  const sensei = VOCAB.find((w) => w.keb === "先生")!;

  test("先生 needs both 先 and 生 — neither alone unlocks it", () => {
    assert.deepEqual(wordKanji("先生"), ["先", "生"]);
    assert.ok(!wordTeachable(sensei, history()));
    assert.ok(
      !wordTeachable(sensei, claiming([kanjiMeaningFactId("先")])),
      "先 alone is not enough",
    );
    assert.ok(
      wordTeachable(
        sensei,
        claiming([kanjiMeaningFactId("先"), kanjiMeaningFactId("生")]),
      ),
      "both known → teachable",
    );
  });

  test("nextWordLesson never hands out a word whose kanji aren't all known", () => {
    // Know only 先 and 生: any kanji word the lesson offers must be built solely
    // from known kanji (kana-only words are always fair game).
    const h = claiming([kanjiMeaningFactId("先"), kanjiMeaningFactId("生")]);
    const known = new Set(["先", "生"]);
    const lesson = nextWordLesson(h, 8)!;
    for (const card of lesson.cards) {
      if (card.kana) continue;
      for (const c of wordKanji(card.keb)) {
        assert.ok(known.has(c), `${card.keb} needs unknown kanji ${c}`);
      }
    }
  });

  test("a met word is skipped, not re-taught", () => {
    const first = nextWordLesson(allKanjiKnown(), 3)!;
    // Meet the first lesson's words (claim their meaning), and the next call
    // moves past them.
    const met = claiming([
      ...allKanjiFacts(),
      ...first.cards.map((c) => wordMeaningFactId(c.keb)),
    ]);
    const second = nextWordLesson(met, 3)!;
    const firstKebs = new Set(first.cards.map((c) => c.keb));
    for (const card of second.cards) {
      assert.ok(!firstKebs.has(card.keb), `${card.keb} was re-taught`);
    }
    // The position moves forward by the words actually met, not by a lesson
    // ordinal: the second lesson starts where the first one ended.
    assert.equal(second.position.from, first.position.to + 1);
  });
});

// The card counts WORDS — "12–17 of 6,213" — where it used to count lessons and
// print no total at all.
describe("the position counts WORDS, against a total that does not move", () => {
  test("the total is counted off the curriculum, not the rank bound", () => {
    // Equal today because beginnerRank is dense. They are different claims, and
    // the constant is the one that stays right if a re-cut leaves a hole.
    assert.equal(WORDS_CURRICULUM_TOTAL, CURRICULUM_WORDS.length);
    assert.equal(WORDS_CURRICULUM_TOTAL, 6213);
    assert.ok(WORDS_CURRICULUM_TOTAL <= WORDS_CURRICULUM_MAX);
  });

  test("the span is as wide as the lesson, and starts at words-met + 1", () => {
    const first = nextWordLesson(allKanjiKnown(), 4)!;
    assert.equal(first.position.from, 1);
    assert.equal(first.position.to, first.cards.length);
    assert.equal(first.position.total, WORDS_CURRICULUM_TOTAL);
  });

  test("the total is the same whatever the lesson size — only the span moves", () => {
    // The reason to count items: lesson SIZE is a setting, so a lesson count
    // would swing with it while the material stands still.
    const small = nextWordLesson(allKanjiKnown(), 2)!;
    const big = nextWordLesson(allKanjiKnown(), 8)!;
    assert.equal(small.position.total, big.position.total);
    assert.equal(small.position.to, 2);
    assert.equal(big.position.to, 8);
  });
});

describe("the words card LEADS with the top word's gate", () => {
  test("day one: the top word is 何 (rank 1) and it is gated on 何", () => {
    // topWordGate names the word the curriculum most wants to teach next — the
    // lowest-rank unlearned word — REGARDLESS of whether it is teachable. On an
    // empty history that is 何, which nextWordLesson steps over.
    const gate = topWordGate(history())!;
    assert.equal(gate.word.keb, "何");
    assert.equal(gate.rank, 1);
    // Gated: its one kanji 何 is unknown, so it is named as the thing to learn.
    assert.deepEqual(
      gate.missing.map((m) => m.c),
      ["何"],
    );
    // And the missing kanji carries a meaning to read in the sentence.
    assert.ok(gate.missing[0].meaning.length > 0);
  });

  test("a gated lead still offers the available words secondarily", () => {
    // The gate is the lead, but the track is never a dead end: nextWordLesson
    // still returns the best words you CAN learn (all kana-only on day one).
    const h = history();
    assert.ok(topWordGate(h)!.missing.length > 0, "top word is gated");
    const secondary = nextWordLesson(h, 6)!;
    assert.ok(secondary.cards.length > 0, "available words still surface");
    for (const card of secondary.cards) {
      assert.ok(card.kana, `${card.keb} should be kana-only on day one`);
    }
  });

  test("with every kanji known the lead is TEACHABLE — no gate, 何 leads", () => {
    const gate = topWordGate(allKanjiKnown())!;
    assert.equal(gate.word.keb, "何");
    // Nothing missing → the card falls through to the normal lesson, whose head
    // is this same word.
    assert.deepEqual(gate.missing, []);
    assert.equal(nextWordLesson(allKanjiKnown(), 6)!.cards[0].keb, "何");
  });

  test("missing lists ONLY the unknown kanji of the top word", () => {
    // Make 先生 the top unlearned word: meet every lower-ranked word, and know
    // 先 but not 生. The gate then names 先生 and only its still-missing kanji 生.
    const sensei = VOCAB.find((w) => w.keb === "先生")!;
    const below = CURRICULUM_WORDS.filter(
      (w) => w.beginnerRank < sensei.beginnerRank,
    ).map((w) => wordMeaningFactId(w.keb));
    const h = claiming([...below, kanjiMeaningFactId("先")]);

    const gate = topWordGate(h)!;
    assert.equal(gate.word.keb, "先生");
    assert.deepEqual(
      gate.missing.map((m) => m.c),
      ["生"],
    );
  });

  test("topWordGate is null only when the whole curriculum is learned", () => {
    const everyWord = claiming(
      CURRICULUM_WORDS.map((w) => wordMeaningFactId(w.keb)),
    );
    assert.equal(topWordGate(everyWord), null);
    // The same finished state nextWordLesson returns null for.
    assert.equal(nextWordLesson(everyWord, 6), null);
  });
});

describe("lesson sizing is a count, clamped", () => {
  test("default is a small count", () => {
    assert.equal(WORDS_PER_LESSON_DEFAULT, 6);
  });
  test("a lesson holds at most `perLesson` words", () => {
    const lesson = nextWordLesson(allKanjiKnown(), 4)!;
    assert.ok(lesson.cards.length <= 4);
  });
  test("clamp keeps it whole and in range", () => {
    assert.equal(clampWordsPerLesson(0), 1);
    assert.equal(clampWordsPerLesson(6.4), 6);
    assert.equal(clampWordsPerLesson(999), 20);
    assert.equal(clampWordsPerLesson(NaN), WORDS_PER_LESSON_DEFAULT);
  });
});

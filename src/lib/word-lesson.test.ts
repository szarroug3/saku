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
  WORDS_PER_LESSON_DEFAULT,
  clampWordsPerLesson,
  isKanaOnlyWord,
  nextWordLesson,
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
    assert.ok(second.index > first.index);
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

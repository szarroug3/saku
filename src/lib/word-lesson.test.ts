// Run: node --import ./src/lib/conjugate/test-hooks.mjs --test \
//        src/lib/word-lesson.test.ts
//
// WHAT THESE TESTS ARE FOR
// ========================
// This file owns WHICH words the curriculum teaches, in WHAT order, and what
// each one owes. The scheduler that used to sit on top of it is gone (see the
// module header); the spine schedules now, and curriculum-lesson.test.ts checks
// the packing. The failure modes left here all type-check — a curriculum that
// quietly drifts off beginnerRank order, a cut that moves, a kana-only word that
// waits on kanji it does not contain, 々 read as a blocking kanji. So these pin
// the ORDER, the CUT, and the PREREQUISITE RULE over the real 12,553.

import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { meaningFactId as kanjiMeaningFactId } from "../data/kanji.ts";
import { VOCAB } from "../data/vocab.ts";
import {
  CURRICULUM_WORDS,
  WORDS_CURRICULUM_MAX,
  WORDS_CURRICULUM_TOTAL,
  WORDS_PER_LESSON_DEFAULT,
  clampWordsPerLesson,
  isKanaOnlyWord,
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

  test("the head of the order is 何, rank 1", () => {
    // The spine weaves prerequisites in ahead of each word, so the ORDER the
    // packer walks starts here whatever the packing does with it.
    assert.equal(CURRICULUM_WORDS[0].keb, "何");
  });
});

describe("a kana-only word owes nothing", () => {
  test("あなた is teachable with an empty history", () => {
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

});

describe("々 is a writing rule, not a kanji prerequisite", () => {
  // The iteration mark 々 is Unicode Han script, so a naive Han scan would treat
  // it as a blocking kanji. But 々 has no kanji row (it is not in the jōyō set),
  // so it could never be "known" and would lock its words forever. It is taught
  // inline as a writing-rule card (like okurigana), never a gate.
  test("wordKanji drops 々, keeping only the real kanji", () => {
    assert.deepEqual(wordKanji("時々"), ["時"]);
    assert.deepEqual(wordKanji("人々"), ["人"]);
    assert.deepEqual(wordKanji("様々"), ["様"]);
  });

  test("a 々 word unlocks once its real kanji is known", () => {
    const tokidoki = VOCAB.find((w) => w.keb === "時々")!;
    assert.ok(!wordTeachable(tokidoki, history()));
    assert.ok(
      wordTeachable(tokidoki, claiming([kanjiMeaningFactId("時")])),
      "時 known → 時々 teachable; 々 does not gate",
    );
  });
});

// The card counts WORDS against a total that does not move, and the spine's
// composite label reads that total off this count — see curriculum-lesson.ts.
describe("the word total is the material, and does not move", () => {
  test("the total is counted off the curriculum, not the rank bound", () => {
    // Equal today because beginnerRank is dense. They are different claims, and
    // the count is the one that stays right if a re-cut leaves a hole.
    assert.equal(WORDS_CURRICULUM_TOTAL, CURRICULUM_WORDS.length);
    assert.equal(WORDS_CURRICULUM_TOTAL, 6213);
    assert.ok(WORDS_CURRICULUM_TOTAL <= WORDS_CURRICULUM_MAX);
  });
});

describe("lesson sizing is a count, clamped", () => {
  test("default is a small count", () => {
    assert.equal(WORDS_PER_LESSON_DEFAULT, 6);
  });
  test("clamp keeps it whole and in range", () => {
    assert.equal(clampWordsPerLesson(0), 1);
    assert.equal(clampWordsPerLesson(6.4), 6);
    assert.equal(clampWordsPerLesson(999), 20);
    assert.equal(clampWordsPerLesson(NaN), WORDS_PER_LESSON_DEFAULT);
  });
});

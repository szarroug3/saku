// Run: node --import ./src/lib/conjugate/test-hooks.mjs --test \
//        src/lib/quiz-instruction.test.ts
//
// THE BUG, IN ONE SCREENSHOT
// ==========================
// Shown "one" with a text box, the owner typed いち. It was marked wrong, twice,
// and then revealed the answer as 一 — a character romaji cannot produce. Two
// faults met on that card:
//
//   1. It never said it wanted the KANJI. No card did; the drill had an optional
//      `context` string that three of six subjects bothered to fill in.
//   2. It should have been a BOARD, not a box. A kanji meaning board draws from
//      the confusable table, 一 has no confusables, so it built one option — and
//      a board of one silently becomes a typed box.
//
// The second is the dangerous one, because it is a question that cannot be
// answered correctly by anyone. It affected 5,827 facts: every radical (they
// fell through to kana's rules and were looked up in the KANA index), every
// unconfusable kanji, and every kanji reading fact asked en2jp (where all the
// distractors are other readings of the SAME kanji, so the board is one glyph
// repeated and dedupes to nothing).
//
// So the headline test here is a sweep, not an example.

import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { KEIGO_FACTS } from "@/data/keigo";
import { meaningFactId } from "@/data/kanji";
import { radicalMeaningFactId } from "@/data/radicals";
import { VERB_PAIRS } from "@/data/transitivity";
import { sideFactId, transitivitySide } from "@/data/transitivity-facts";
import { wordMeaningFactId, wordReadingFactId } from "@/data/vocab";
import { classProductionFactId, patternProductionFactId } from "@/data/grammar";
import { buildMcOptions } from "@/lib/engine";
import { en2jpTypeable, fixedDirOf } from "@/lib/engine/question";
import { ALL_FACTS } from "@/lib/facts";
import { quizInstruction } from "@/lib/quiz-instruction";

describe("no card can be unanswerable", () => {
  test("EVERY fact the drill can ask en2jp is either typeable or gets a board", () => {
    // The invariant the whole fix exists for. If the answer cannot be typed,
    // there must be at least two options to choose between — because DrillScreen
    // falls back to a text box when there are not, and that box cannot be filled.
    const broken: string[] = [];
    for (const fact of ALL_FACTS) {
      if (fixedDirOf(fact) === "jp2en") continue; // never asked en2jp at all
      if (en2jpTypeable(fact)) continue; // answerable with romaji
      if (buildMcOptions(fact).length > 1) continue; // answerable by picking
      broken.push(fact);
    }
    assert.deepEqual(broken, [], `${broken.length} unanswerable cards`);
  });

  test("the two subjects that had NO source of distractors now have one", () => {
    // A radical was looked up in CHAR_INDEX (kana) and missed; a kanji with no
    // confusables had nothing at all. Both returned an empty board.
    assert.ok(buildMcOptions(radicalMeaningFactId("一")).length > 1, "radical");
    assert.ok(buildMcOptions(meaningFactId("一")).length > 1, "unconfusable kanji");
  });

  test("a kanji reading is never asked en2jp, because that board is one glyph", () => {
    // "いち → ?" wants 一, and 一's other readings all render AS 一.
    const reading = ALL_FACTS.find((f) => String(f).startsWith("kanji:一/reading@"));
    assert.ok(reading, "一 has reading facts");
    assert.equal(fixedDirOf(reading), "jp2en");
    // And its meaning fact keeps BOTH directions — "en→kanji and kanji→en".
    assert.equal(fixedDirOf(meaningFactId("一")), undefined);
  });
});

describe("every card says what it wants", () => {
  test("no fact anywhere is left without an instruction", () => {
    const silent: string[] = [];
    for (const fact of ALL_FACTS) {
      for (const dir of ["en2jp", "jp2en"] as const) {
        for (const mode of ["mc", "typed"] as const) {
          if (!quizInstruction(fact, dir, mode)) silent.push(`${fact} ${dir} ${mode}`);
        }
      }
    }
    assert.deepEqual(silent.slice(0, 5), [], `${silent.length} silent cards`);
  });

  test("the card from the screenshot now names the kanji", () => {
    assert.equal(
      quizInstruction(meaningFactId("一"), "en2jp", "mc"),
      "Which of these is the correct kanji?",
    );
  });

  test("a word asked by its MEANING wants the word; by its READING, the sound", () => {
    // The distinction the owner drew herself: choose the kanji for recognition,
    // and separately be quizzed on the pronunciation.
    assert.equal(
      quizInstruction(wordMeaningFactId("問題"), "en2jp", "mc"),
      "Which of these is the correct word?",
    );
    assert.equal(
      quizInstruction(wordReadingFactId("問題"), "en2jp", "typed"),
      "Type how this word is said.",
    );
    assert.equal(
      quizInstruction(wordReadingFactId("問題"), "en2jp", "mc"),
      "Which of these is how this word is written?",
    );
  });

  test("a MEANING instruction names the role, so kanji and word differ", () => {
    // The bug: "Type what it means." on every meaning card. But 可 as a KANJI
    // means "can" and as a WORD means "acceptable" — asked jp2en, the same glyph
    // gives two different answers, and only the NOUN says which one the card
    // wants. So the two must not read the same sentence.
    assert.equal(
      quizInstruction(meaningFactId("一"), "jp2en", "typed"),
      "Type what this kanji means.",
    );
    assert.equal(
      quizInstruction(wordMeaningFactId("問題"), "jp2en", "typed"),
      "Type what this word means.",
    );
    assert.notEqual(
      quizInstruction(meaningFactId("一"), "jp2en", "typed"),
      quizInstruction(wordMeaningFactId("問題"), "jp2en", "typed"),
    );
    // The pick-one line names the role the same way.
    assert.equal(
      quizInstruction(meaningFactId("一"), "jp2en", "mc"),
      "Which of these is what this kanji means?",
    );
    assert.equal(
      quizInstruction(wordMeaningFactId("問題"), "jp2en", "mc"),
      "Which of these is what this word means?",
    );
  });

  test("KANA IS NOT A MEANING, in either direction", () => {
    // Both directions got this wrong in earlier drafts. Shown "a" you produce
    // the CHARACTER あ (not "how it's said"), and shown あ you produce the
    // romaji (not "what it means" — あ does not mean anything).
    const a = ALL_FACTS.find((f) => String(f).startsWith("kana:あ"));
    assert.ok(a);
    assert.equal(quizInstruction(a, "en2jp", "mc"), "Which of these is the correct kana?");
    assert.equal(quizInstruction(a, "jp2en", "typed"), "Type how this kana is said.");
  });

  test("transitivity and keigo fold the role into one clean question", () => {
    // The grey sub-label under these cards is gone; the register/role now lives
    // in the answer options, so the instruction is a single pinned question.
    const trans = sideFactId(
      VERB_PAIRS.find(
        (p) =>
          transitivitySide(sideFactId(p, "happens"))!.askable &&
          transitivitySide(sideFactId(p, "doIt"))!.askable,
      )!,
      "happens",
    );
    assert.equal(
      quizInstruction(trans, "jp2en", "mc"),
      "Which of these is what this verb means?",
    );
    assert.equal(
      quizInstruction(trans, "en2jp", "typed"),
      "Type the verb that fits.",
    );

    const keigo = KEIGO_FACTS[0].id;
    assert.equal(
      quizInstruction(keigo, "jp2en", "mc"),
      "Which of these is what this keigo verb means?",
    );
    assert.equal(
      quizInstruction(keigo, "en2jp", "typed"),
      "Type the keigo verb.",
    );
  });

  test("the instruction follows the MODE, not just the fact", () => {
    // "Which of these" over a text box would be worse than saying nothing.
    const f = meaningFactId("一");
    assert.match(quizInstruction(f, "jp2en", "mc") ?? "", /^Which of these/);
    assert.match(quizInstruction(f, "jp2en", "typed") ?? "", /^Type /);
  });
});

describe("a production card names the class of an unknown class word", () => {
  // A る-ending verb drawn in kana does not say ichidan or godan, and an
  // adjective's spelling does not reliably say い or な. The instruction supplies
  // that class for an unknown word. A known word keeps plain "word" because its
  // class moves to the optional hint.
  const TAI_I = classProductionFactId("tai", "v1");
  const TAI_R = classProductionFactId("tai", "v5r");
  const ICHIDAN_UNKNOWN = { surface: "食べる", kana: "たべる", cls: "v1", known: false } as const;
  const GODAN_RU_UNKNOWN = { surface: "帰る", kana: "かえる", cls: "v5r", known: false } as const;

  test("an unknown ichidan verb is called a る-verb", () => {
    assert.equal(
      quizInstruction(TAI_I, "en2jp", "typed", ICHIDAN_UNKNOWN),
      "Type how this る-verb is said in the 〜たい form.",
    );
  });

  test("an unknown godan-る verb is called a う-verb", () => {
    assert.equal(
      quizInstruction(TAI_R, "en2jp", "typed", GODAN_RU_UNKNOWN),
      "Type how this う-verb is said in the 〜たい form.",
    );
  });

  test("a KNOWN る-verb keeps the plain 'word' — its class rides in the hint", () => {
    assert.equal(
      quizInstruction(TAI_I, "en2jp", "typed", { ...ICHIDAN_UNKNOWN, known: true }),
      "Type how this word is said in the 〜たい form.",
    );
  });

  test("no vehicle, and a non-る verb, both stay 'word'", () => {
    assert.equal(
      quizInstruction(TAI_I, "en2jp", "typed"),
      "Type how this word is said in the 〜たい form.",
    );
    assert.equal(
      quizInstruction(classProductionFactId("tai", "v5k"), "en2jp", "typed", {
        surface: "書く",
        kana: "かく",
        cls: "v5k",
        known: false,
      }),
      "Type how this word is said in the 〜たい form.",
    );
  });

  test("unknown adjectives are named by type", () => {
    const adjI = patternProductionFactId("sugiru", "adj-i");
    const adjNa = patternProductionFactId("node", "adj-na");
    assert.equal(
      quizInstruction(adjI, "en2jp", "typed", {
        surface: "高い", kana: "たかい", cls: "adj-i", known: false,
      }),
      "Type how this い-adjective is said in the 〜すぎる form.",
    );
    assert.equal(
      quizInstruction(adjNa, "en2jp", "typed", {
        surface: "静か", kana: "しずか", cls: "adj-na", known: false,
      }),
      "Type how this な-adjective is said in the 〜ので form.",
    );
  });

  test("a KNOWN adjective keeps the plain 'word' — its class rides in the hint", () => {
    assert.equal(
      quizInstruction(patternProductionFactId("node", "adj-na"), "en2jp", "typed", {
        surface: "嫌い", kana: "きらい", cls: "adj-na", known: true,
      }),
      "Type how this word is said in the 〜ので form.",
    );
  });
});

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

import { meaningFactId } from "@/data/kanji";
import { radicalMeaningFactId } from "@/data/radicals";
import { wordMeaningFactId, wordReadingFactId } from "@/data/vocab";
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
      "Type how it's said.",
    );
  });

  test("KANA IS NOT A MEANING, in either direction", () => {
    // Both directions got this wrong in earlier drafts. Shown "a" you produce
    // the CHARACTER あ (not "how it's said"), and shown あ you produce the
    // romaji (not "what it means" — あ does not mean anything).
    const a = ALL_FACTS.find((f) => String(f).startsWith("kana:あ"));
    assert.ok(a);
    assert.equal(quizInstruction(a, "en2jp", "mc"), "Which of these is the correct kana?");
    assert.equal(quizInstruction(a, "jp2en", "typed"), "Type how it's said.");
  });

  test("the instruction follows the MODE, not just the fact", () => {
    // "Which of these" over a text box would be worse than saying nothing.
    const f = meaningFactId("一");
    assert.match(quizInstruction(f, "jp2en", "mc") ?? "", /^Which of these/);
    assert.match(quizInstruction(f, "jp2en", "typed") ?? "", /^Type /);
  });
});

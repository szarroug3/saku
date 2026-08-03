import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  VOCAB,
  VOCAB_SUBJECT,
  isKanaWord,
  vocabRow,
  wordMeaningFactId,
  wordReadingFactId,
} from "@/data/vocab";
import { enabledFormsFor, formIsMc } from "@/lib/ask-forms";
import { buildMcOptions, checkTyped } from "@/lib/engine";
import { questionsFor } from "@/lib/engine/question";
import { factInfo } from "@/lib/facts";
import type { AskConfig, FactId } from "@/types";

const ALL: AskConfig = {
  japanese: {
    prompts: ["text", "audio"],
    responses: ["definition", "romaji"],
    answers: ["typed", "mc"],
  },
  sentence: {
    prompts: ["text", "audio"],
    responses: ["definition", "romaji"],
    answers: ["typed", "mc"],
    englishResponses: ["ordering", "selection"],
  },
  english: { answers: ["typed", "mc"] },
};

function shape(fact: FactId) {
  return enabledFormsFor(fact, ALL).map((form) => ({
    source: form.source,
    response: form.response,
    listen: form.listen,
    dir: form.dir,
    control: formIsMc(fact, form) ? "mc" : "typed",
  }));
}

// A word MEANING is asked only jp→en (Rule A: words are jp2en only, one card per
// fact per reading-unit). The card shows the glyph and reading and asks the
// English meaning. Text and Audio are its two prompts; the separate MC board is
// gone (Rule B: a typed card carries the Show-choices button, so the redundant
// MC sibling of a typed jp→en card is dropped). What survives is exactly the two
// typed jp→en cards: visual and, because a word is listenable, audio.
const JP_MEANING = [
  {
    source: "japanese",
    response: "definition",
    listen: false,
    dir: "jp2en",
    control: "typed",
  },
  {
    source: "japanese",
    response: "definition",
    listen: true,
    dir: "jp2en",
    control: "typed",
  },
];

// A WRITTEN word meaning is just those two jp→en typed cards. The old en→jp
// "produce the written form" MC is gone by Rule A (no en2jp word card at all).
const WRITTEN_MEANING_SHAPES = [...JP_MEANING];

// A KANA-ONLY word carries the same two jp→en meaning cards PLUS the deliberate
// audio-dictation exception (isKanaOnlyWordMeaningFact): hear これ, type これ. Its
// MC sibling is dropped by Rule B because the kana target is typeable, leaving a
// single typed dictation card. There is no en→jp English-recall card any more
// (Rule A) and no separate reading fact.
const KANA_MEANING_SHAPES = [
  ...JP_MEANING,
  {
    source: "japanese",
    response: "japanese",
    listen: true,
    dir: "en2jp",
    control: "typed",
  },
];

// A written word READING is asked only jp→en (Rule A): show the glyph and
// definition, ask the kana reading. Text and Audio prompts give two typed cards;
// the MC siblings are dropped by Rule B and the old en→jp cards by Rule A.
const READING_SHAPES = [
  {
    source: "japanese",
    response: "romaji",
    listen: false,
    dir: "jp2en",
    control: "typed",
  },
  {
    source: "japanese",
    response: "romaji",
    listen: true,
    dir: "jp2en",
    control: "typed",
  },
];

const kanaWords = VOCAB.filter(isKanaWord);
const writtenWords = VOCAB.filter((word) => !isKanaWord(word));

describe("question matrix §3: words", () => {
  test("every kana-only word exposes meaning forms plus audio dictation, and no reading fact", () => {
    assert.ok(kanaWords.length > 0);
    for (const word of kanaWords) {
      const meaning = wordMeaningFactId(word.keb);
      assert.deepEqual(shape(meaning), KANA_MEANING_SHAPES, meaning);
      assert.equal(
        factInfo(wordReadingFactId(word.keb)),
        undefined,
        `${word.keb}: kana-only words must not gain a duplicate reading fact`,
      );
    }
  });

  test("every written word meaning has exactly the two jp→en typed controls (text and audio)", () => {
    assert.ok(writtenWords.length > 0);
    for (const word of writtenWords) {
      const fact = wordMeaningFactId(word.keb);
      assert.deepEqual(shape(fact), WRITTEN_MEANING_SHAPES, fact);
    }
  });

  test("every written word reading has exactly the two documented controls", () => {
    for (const word of writtenWords) {
      const fact = wordReadingFactId(word.keb);
      assert.deepEqual(shape(fact), READING_SHAPES, fact);
    }
  });

  test("audio reading MC identifies the written word, never printed kana", () => {
    const fact = wordReadingFactId(writtenWords[0].keb);
    const options = buildMcOptions(fact, "jp2en", { listen: true });
    assert.ok(options.length > 1);
    for (const option of options) {
      const label = questionsFor(fact).optionLabel?.(option, "jp2en", {
        listen: true,
      });
      assert.equal(label, factInfo(option)?.glyph, option);
    }
  });

  test("English reading prompts use meanings, not Romaji", () => {
    for (const word of writtenWords.slice(0, 500)) {
      const fact = wordReadingFactId(word.keb);
      const prompt = questionsFor(fact).prompt(fact, "en2jp");
      assert.equal(prompt.jp, false, fact);
      assert.equal(prompt.glyph, factInfo(fact)?.meaning, fact);
      assert.notEqual(prompt.glyph, word.reb, fact);
    }
  });

  test("visible Japanese self-copy and visible Romaji prompt routes remain absent", () => {
    for (const word of VOCAB) {
      for (const fact of [
        wordMeaningFactId(word.keb),
        ...(isKanaWord(word) ? [] : [wordReadingFactId(word.keb)]),
      ]) {
        for (const form of enabledFormsFor(fact, ALL)) {
          assert.equal(
            form.listen === false &&
              form.dir === "en2jp" &&
              questionsFor(fact).prompt(fact, form.dir).glyph === word.reb,
            false,
            `${fact}: Romaji/reading must not be a visible prompt`,
          );
          if (form.source === "japanese" && !form.listen) {
            assert.equal(
              form.dir === "en2jp",
              false,
              `${fact}: visible Japanese must not ask for itself`,
            );
          }
        }
      }
    }
  });

  test("documented examples grade against meaning, reading, and written-form targets", () => {
    const word =
      vocabRow("食べる") ??
      writtenWords.find((candidate) => candidate.keb !== candidate.reb);
    assert.ok(word);
    const meaning = wordMeaningFactId(word.keb);
    const reading = wordReadingFactId(word.keb);
    assert.equal(checkTyped(meaning, word.glosses[0], "jp2en"), true);
    assert.equal(checkTyped(meaning, word.keb, "en2jp"), true);
    assert.equal(checkTyped(reading, word.reb, "jp2en"), true);
    assert.equal(checkTyped(reading, word.reb, "en2jp"), true);
  });

  test("all word facts stay registered to the word subject", () => {
    for (const word of VOCAB) {
      const facts = [
        wordMeaningFactId(word.keb),
        ...(isKanaWord(word) ? [] : [wordReadingFactId(word.keb)]),
      ];
      for (const fact of facts) {
        assert.equal(factInfo(fact)?.subject, VOCAB_SUBJECT, fact);
      }
    }
  });
});

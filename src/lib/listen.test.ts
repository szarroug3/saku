// Run: node --import ./src/lib/conjugate/test-hooks.mjs --test src/lib/listen.test.ts
//
// The listening question types (task 22): two audio-prompt types over EXISTING
// word facts, WORD-ONLY, and OPT-IN — never forced, never a gate. These tests
// pin exactly those properties: both types exist, both are off by default, they
// classify only words, and an audio card never shows its own answer as text.

import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { kanaFact } from "../data/characters.ts";
import { patternMeaningFactId } from "../data/grammar/index.ts";
import { RECIPES } from "../data/grammar/recipes.ts";
import { meaningFactId } from "../data/kanji.ts";
import {
  VOCAB,
  isKanaWord,
  wordMeaningFactId,
  wordReadingFactId,
} from "../data/vocab.ts";
import { factInfo } from "./facts.ts";
import { speechForFact } from "./fact-speech.ts";
import { listenEnabledFor, listenKind, pickListen } from "./listen.ts";
import { questionsFor } from "./engine/question.ts";
import type { QuizConfig } from "@/types";

// pickListen / listenEnabledFor read only the two listen flags off the config.
function cfg(listenRomaji: boolean, listenMeaning: boolean): QuizConfig {
  return { listenRomaji, listenMeaning } as QuizConfig;
}

// A word written with kanji — it has a real reading fact (a kana word does not).
const kanjiWord = VOCAB.find((w) => !isKanaWord(w))!;
const kanaWord = VOCAB.find((w) => isKanaWord(w))!;
const readingFact = wordReadingFactId(kanjiWord.keb);
const meaningFact = wordMeaningFactId(kanjiWord.keb);

describe("listenKind — words only", () => {
  test("a word reading fact is the romaji type", () => {
    assert.equal(listenKind(readingFact), "romaji");
  });

  test("a word meaning fact is the meaning type", () => {
    assert.equal(listenKind(meaningFact), "meaning");
  });

  test("a kana word has no reading fact, so only its meaning is listenable", () => {
    assert.equal(listenKind(wordMeaningFactId(kanaWord.keb)), "meaning");
  });

  test("kana, kanji and grammar are never listenable", () => {
    assert.equal(listenKind(kanaFact("あ")), null);
    assert.equal(listenKind(meaningFactId("生")), null);
    assert.equal(listenKind(patternMeaningFactId(RECIPES[0].id)), null);
  });
});

describe("opt-in and non-gating", () => {
  test("both types are OFF by default — pickListen never fires, even on a sure coin", () => {
    // rng() => 0 would clear any threshold; the gate is the flags, not the coin.
    assert.equal(pickListen(readingFact, cfg(false, false), () => 0), false);
    assert.equal(pickListen(meaningFact, cfg(false, false), () => 0), false);
  });

  test("each flag enables only its own type", () => {
    assert.equal(listenEnabledFor(readingFact, cfg(true, false)), true);
    assert.equal(listenEnabledFor(meaningFact, cfg(true, false)), false);
    assert.equal(listenEnabledFor(readingFact, cfg(false, true)), false);
    assert.equal(listenEnabledFor(meaningFact, cfg(false, true)), true);
  });

  test("enabled, the coin decides — additive, so a share of showings stay visual", () => {
    assert.equal(pickListen(readingFact, cfg(true, true), () => 0), true);
    assert.equal(pickListen(readingFact, cfg(true, true), () => 0.99), false);
  });

  test("turning listening on never turns a non-word into an audio card", () => {
    const kana = kanaFact("あ");
    const kanji = meaningFactId("生");
    assert.equal(pickListen(kana, cfg(true, true), () => 0), false);
    assert.equal(pickListen(kanji, cfg(true, true), () => 0), false);
  });
});

describe("an audio card never leaks its answer as text", () => {
  // Same invariant as prompt-not-answer.test.ts, for listening: the card hides
  // the glyph and shows only the context word ("reading" / "meaning"). That word
  // must not itself grade as the answer, and the card must have a sound to play.
  for (const [label, fact] of [
    ["reading", readingFact],
    ["meaning", meaningFact],
  ] as const) {
    test(`the ${label} card shows only its context, and the context is not the answer`, () => {
      const qt = questionsFor(fact);
      const prompt = qt.prompt(fact, "jp2en");
      // The only text a listening card renders is the context line.
      assert.ok(prompt.context, "a listening card needs its context word on screen");
      assert.equal(
        qt.check(fact, "jp2en", prompt.context!),
        false,
        "the context word must not grade as the answer",
      );
      // The card is not silent: the word has a sound to play.
      const info = factInfo(fact);
      assert.ok(info, "the fact resolves");
      assert.ok(speechForFact(info!), "a listening card must have audio to play");
    });
  }
});

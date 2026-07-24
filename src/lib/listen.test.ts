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
import { listenKind } from "./listen.ts";
import { questionsFor } from "./engine/question.ts";

const kanjiWord = VOCAB.find((w) => !isKanaWord(w))!;
const kanaWord = VOCAB.find((w) => isKanaWord(w))!;
const readingFact = wordReadingFactId(kanjiWord.keb);
const meaningFact = wordMeaningFactId(kanjiWord.keb);

describe("listenKind — audio support is a property of the fact", () => {
  test("word readings and meanings name their response", () => {
    assert.equal(listenKind(readingFact), "romaji");
    assert.equal(listenKind(meaningFact), "meaning");
    assert.equal(listenKind(wordMeaningFactId(kanaWord.keb)), "meaning");
  });

  test("kana, kanji and grammar are not word-audio facts", () => {
    assert.equal(listenKind(kanaFact("あ")), null);
    assert.equal(listenKind(meaningFactId("生")), null);
    assert.equal(listenKind(patternMeaningFactId(RECIPES[0].id)), null);
  });
});

describe("an audio card never leaks its answer as text", () => {
  for (const [label, fact] of [
    ["reading", readingFact],
    ["meaning", meaningFact],
  ] as const) {
    test(`${label} has a safe context and something to play`, () => {
      const qt = questionsFor(fact);
      const prompt = qt.prompt(fact, "jp2en");
      assert.ok(prompt.context);
      assert.equal(qt.check(fact, "jp2en", prompt.context!), false);
      const info = factInfo(fact);
      assert.ok(info);
      assert.ok(speechForFact(info!));
    });
  }
});

import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { KANJI_SUBJECT } from "@/data/kanji";
import { RADICAL_SUBJECT } from "@/data/radicals";
import { enabledFormsFor, formIsMc } from "@/lib/ask-forms";
import { buildMcOptions, checkTyped } from "@/lib/engine";
import {
  answerIsJapanese,
  questionsFor,
} from "@/lib/engine/question";
import { ALL_FACTS, factInfo } from "@/lib/facts";
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

const factsFor = (subject: string): FactId[] =>
  ALL_FACTS.filter((fact) => factInfo(fact)?.subject === subject);

const kanjiFacts = factsFor(KANJI_SUBJECT);
const radicalFacts = factsFor(RADICAL_SUBJECT);
const kanjiMeanings = kanjiFacts.filter(
  (fact) => !answerIsJapanese(fact, "jp2en"),
);
const kanjiReadings = kanjiFacts.filter((fact) =>
  answerIsJapanese(fact, "jp2en"),
);

function shape(fact: FactId) {
  return enabledFormsFor(fact, ALL).map((form) => ({
    source: form.source,
    response: form.response,
    listen: form.listen,
    dir: form.dir,
    control: formIsMc(fact, form) ? "mc" : "typed",
  }));
}

// A kanji/radical MEANING keeps two cards. jp→en is a typed English recall; its
// MC sibling is dropped (Rule B: the typed card carries the Show-choices button).
// en→jp survives as MC because the glyph is the target and a glyph cannot be
// romaji-typed, so it has no typed sibling to defer to.
const MEANING_SHAPES = [
  {
    source: "japanese",
    response: "definition",
    listen: false,
    dir: "jp2en",
    control: "typed",
  },
  {
    source: "english",
    response: "japanese",
    listen: false,
    dir: "en2jp",
    control: "mc",
  },
];

// A kanji READING (anchored, jp→en only) is a typed card. Its MC sibling is
// dropped by Rule B, leaving the single anchored text → kana typed control.
const READING_SHAPES = [
  {
    source: "japanese",
    response: "romaji",
    listen: false,
    dir: "jp2en",
    control: "typed",
  },
];

describe("question matrix §2: kanji and radicals", () => {
  test("every kanji and radical meaning has exactly the two documented forms", () => {
    assert.ok(kanjiMeanings.length > 0);
    assert.ok(radicalFacts.length > 0);
    for (const fact of [...kanjiMeanings, ...radicalFacts]) {
      assert.deepEqual(shape(fact), MEANING_SHAPES, fact);
    }
  });

  test("every kanji reading has only anchored text → kana typed", () => {
    assert.ok(kanjiReadings.length > 0);
    for (const fact of kanjiReadings) {
      assert.deepEqual(shape(fact), READING_SHAPES, fact);
      const prompt = questionsFor(fact).prompt(fact, "jp2en");
      assert.equal(prompt.jp, true, fact);
      assert.ok(prompt.glyph.length > 0, fact);
      assert.ok(
        prompt.context === "on its own" || prompt.context?.startsWith("in "),
        `${fact}: reading prompt must visibly identify its anchor`,
      );
    }
  });

  test("radicals carry meaning only and can never acquire a reading form", () => {
    for (const fact of radicalFacts) {
      assert.equal(answerIsJapanese(fact, "jp2en"), false, fact);
      assert.equal(
        enabledFormsFor(fact, {
          japanese: {
            prompts: ["text", "audio"],
            responses: ["romaji"],
            answers: ["typed", "mc"],
          },
          sentence: {
            prompts: [],
            responses: [],
            answers: [],
            englishResponses: [],
          },
          english: { answers: [] },
        }).length,
        0,
        fact,
      );
    }
  });

  test("audio and visible self-copy forms are structurally absent", () => {
    for (const fact of [...kanjiFacts, ...radicalFacts]) {
      const forms = enabledFormsFor(fact, ALL);
      assert.equal(forms.some((form) => form.listen), false, fact);
      assert.equal(
        forms.some(
          (form) =>
            form.dir === "en2jp" &&
            !formIsMc(fact, form),
        ),
        false,
        `${fact}: a glyph response must never become typed self-copy`,
      );
    }
  });

  test("meaning and reading examples grade on the documented answer axis", () => {
    const meaning = kanjiMeanings[0];
    const meaningInfo = factInfo(meaning);
    assert.ok(meaningInfo);
    assert.equal(
      checkTyped(meaning, meaningInfo.answers[0], "jp2en"),
      true,
    );
    assert.equal(checkTyped(meaning, meaningInfo.glyph, "jp2en"), false);
    assert.equal(checkTyped(meaning, meaningInfo.glyph, "en2jp"), true);

    const reading = kanjiReadings[0];
    const readingInfo = factInfo(reading);
    assert.ok(readingInfo);
    assert.equal(
      checkTyped(reading, readingInfo.answers[0], "jp2en"),
      true,
    );
    assert.equal(checkTyped(reading, readingInfo.glyph, "jp2en"), false);
  });

  test("current MC forms build real, nontrivial boards", () => {
    for (const fact of [
      kanjiMeanings[0],
      radicalFacts[0],
      kanjiReadings[0],
    ]) {
      const options = buildMcOptions(fact, "jp2en");
      assert.ok(options.length > 1, `${fact}: expected a usable MC board`);
      assert.ok(options.includes(fact), `${fact}: board must contain its answer`);
    }
  });
});

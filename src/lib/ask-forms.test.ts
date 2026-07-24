import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { kanaFact } from "@/data/characters";
import { patternMeaningFactId } from "@/data/grammar";
import { RECIPES } from "@/data/grammar/recipes";
import { VOCAB, isKanaWord, wordMeaningFactId, wordReadingFactId } from "@/data/vocab";
import {
  buildCoverageDeck,
  enabledFormsFor,
  formIsMc,
} from "@/lib/ask-forms";
import type { AskConfig } from "@/types";

const word = VOCAB.find((w) => !isKanaWord(w))!;
const reading = wordReadingFactId(word.keb);
const meaning = wordMeaningFactId(word.keb);

const ALL: AskConfig = {
  japanese: {
    prompts: ["text", "audio"],
    responses: ["definition", "romaji"],
    answers: ["typed", "mc"],
  },
  sentence: { prompts: [], responses: [], answers: [] },
  english: { answers: ["typed", "mc"] },
};

describe("enabledFormsFor", () => {
  test("a word reading covers text/audio × typed/MC plus both English forms", () => {
    const forms = enabledFormsFor(reading, ALL);
    assert.equal(forms.length, 6);
    assert.equal(forms.filter((f) => f.listen).length, 2);
    assert.deepEqual(
      new Set(forms.map((f) => f.source)),
      new Set(["japanese", "english"]),
    );
  });

  test("response selection narrows meaning and reading facts independently", () => {
    const definitionOnly: AskConfig = {
      ...ALL,
      japanese: { ...ALL.japanese, responses: ["definition"] },
      english: { answers: [] },
    };
    assert.equal(enabledFormsFor(reading, definitionOnly).length, 0);
    assert.equal(enabledFormsFor(meaning, definitionOnly).length, 4);
  });

  test("Audio is dropped for a fact with no audio support", () => {
    const audioOnly: AskConfig = {
      ...ALL,
      japanese: {
        prompts: ["audio"],
        responses: ["romaji"],
        answers: ["typed"],
      },
      english: { answers: [] },
    };
    assert.deepEqual(enabledFormsFor(kanaFact("あ"), audioOnly), []);
  });

  test("forms that resolve to the same forced control are deduped", () => {
    const forms = enabledFormsFor(kanaFact("あ"), {
      ...ALL,
      japanese: {
        prompts: ["text"],
        responses: ["romaji"],
        answers: ["typed", "mc"],
      },
      english: { answers: [] },
    });
    assert.equal(forms.length, 2);
    assert.deepEqual(forms.map((f) => formIsMc(kanaFact("あ"), f)), [false, true]);
  });

  for (const prompt of ["text", "audio"] as const) {
    for (const answer of ["typed", "mc"] as const) {
      test(`sentence romaji supports ${prompt} + ${answer} on a non-kana form`, () => {
        const forms = enabledFormsFor(reading, {
          japanese: { prompts: [], responses: [], answers: [] },
          sentence: {
            prompts: [prompt],
            responses: ["romaji"],
            answers: [answer],
          },
          english: { answers: [] },
        });
        assert.equal(forms.length, 1);
        assert.deepEqual(forms[0], {
          source: "sentence",
          response: "romaji",
          listen: prompt === "audio",
          dir: "jp2en",
          answer,
        });
      });
    }
  }

  for (const prompt of ["text", "audio"] as const) {
    test(`sentence definition supports ${prompt} + multiple choice`, () => {
      const fact = patternMeaningFactId(RECIPES[0].id);
      const forms = enabledFormsFor(fact, {
        japanese: { prompts: [], responses: [], answers: [] },
        sentence: {
          prompts: [prompt],
          responses: ["definition"],
          answers: ["mc"],
        },
        english: { answers: [] },
      });
      assert.deepEqual(forms, [
        {
          source: "sentence",
          response: "definition",
          listen: prompt === "audio",
          dir: "jp2en",
          answer: "mc",
        },
      ]);
    });
  }

  test("sentence definition + Type it creates no unsupported card", () => {
    const fact = patternMeaningFactId(RECIPES[0].id);
    assert.deepEqual(
      enabledFormsFor(fact, {
        japanese: { prompts: [], responses: [], answers: [] },
        sentence: {
          prompts: ["text"],
          responses: ["definition"],
          answers: ["typed"],
        },
        english: { answers: [] },
      }),
      [],
    );
  });
});

describe("buildCoverageDeck", () => {
  test("expands every fact into every enabled form and keeps pairs aligned", () => {
    const expected = [
      ...enabledFormsFor(reading, ALL).map((form) => ({ f: reading, form })),
      ...enabledFormsFor(meaning, ALL).map((form) => ({ f: meaning, form })),
    ];
    const got = buildCoverageDeck([reading, meaning], ALL, (pairs) => pairs);
    assert.deepEqual(got.deck, expected.map((p) => p.f));
    assert.deepEqual(got.forms, expected.map((p) => p.form));
    assert.ok(got.forms.some((f) => f.listen), "Audio must be in coverage");
  });

  test("the injected shuffle moves a fact and its form as one card", () => {
    const got = buildCoverageDeck([reading], ALL, (pairs) => pairs.reverse());
    const expected = enabledFormsFor(reading, ALL).reverse();
    assert.deepEqual(got.forms, expected);
    assert.ok(got.deck.every((f) => f === reading));
  });
});

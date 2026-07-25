import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { kanaFact } from "@/data/characters";
import { READING_INDEX } from "@/data/kanji";
import { patternMeaningFactId } from "@/data/grammar";
import { RECIPES } from "@/data/grammar/recipes";
import { VOCAB, isKanaWord, wordMeaningFactId, wordReadingFactId } from "@/data/vocab";
import {
  buildCoverageDeck,
  enabledFormsFor,
  formIsMc,
} from "@/lib/ask-forms";
import { ALL_FACTS } from "@/lib/facts";
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

  test("kanji reading facts never get audio forms", () => {
    const firstKanjiReading = READING_INDEX.keys().next().value;
    assert.ok(firstKanjiReading, "expected at least one kanji reading fact");
    const forms = enabledFormsFor(firstKanjiReading, ALL);
    assert.ok(forms.length > 0, "kanji reading should still have non-audio forms");
    assert.equal(forms.some((f) => f.listen), false);
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

  test("kana en→jp typed renders as MC card (the form can only be asked as MC)", () => {
    const forms = enabledFormsFor(kanaFact("あ"), {
      japanese: { prompts: [], responses: [], answers: [] },
      sentence: { prompts: [], responses: [], answers: [] },
      english: { answers: ["typed"] },
    });
    assert.deepEqual(forms.length, 1);
    assert.deepEqual(formIsMc(kanaFact("あ"), forms[0]), true);
  });


  test("typed forms that resolve to MC are kept and rendered as MC", () => {
    const typedOnly: AskConfig = {
      japanese: {
        prompts: ["text"],
        responses: ["definition", "romaji"],
        answers: ["typed"],
      },
      sentence: {
        prompts: ["text"],
        responses: ["definition", "romaji"],
        answers: ["typed"],
      },
      english: { answers: ["typed"] },
    };
    // Facts that require MC for some directions (like kana en→jp) should still
    // generate forms when typed is selected — they render as MC. This ensures
    // users see all available facts even when selecting typed-only.
    const kanaEnJp = kanaFact("あ");
    const forms = enabledFormsFor(kanaEnJp, typedOnly);
    const enJpForms = forms.filter((f) => f.dir === "en2jp");
    assert.ok(enJpForms.length > 0, "English should produce a form for kana");
    for (const form of enJpForms) {
      // The form is typed in intent, but resolves to MC because that's the only
      // way kana can be asked in en→jp direction
      assert.equal(form.answer, "typed");
      assert.equal(formIsMc(kanaEnJp, form), true);
    }
  });

  test("sentence romaji currently emits no forms", () => {
    const forms = enabledFormsFor(reading, {
      japanese: { prompts: [], responses: [], answers: [] },
      sentence: {
        prompts: ["text", "audio"],
        responses: ["romaji"],
        answers: ["typed", "mc"],
      },
      english: { answers: [] },
    });
    assert.deepEqual(forms, []);
  });

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

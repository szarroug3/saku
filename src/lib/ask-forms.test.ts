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

  test("kana en→jp emits no form when only Type it is selected", () => {
    const forms = enabledFormsFor(kanaFact("あ"), {
      japanese: { prompts: [], responses: [], answers: [] },
      sentence: { prompts: [], responses: [], answers: [] },
      english: { answers: ["typed"] },
    });
    assert.deepEqual(forms, []);
  });

  test("Type it never auto-converts to MC", () => {
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
    for (const fact of ALL_FACTS) {
      const forms = enabledFormsFor(fact, typedOnly);
      for (const form of forms) {
        assert.equal(form.answer, "typed", fact);
        assert.equal(formIsMc(fact, form), false, fact);
      }
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

describe("Unreachable Planned forms (settings selected but forms not generated)", () => {
  test("grammar meaning audio is silently dropped (grammar not listenable)", () => {
    const grammarFact = patternMeaningFactId(RECIPES[0].id);
    const audioOnly: AskConfig = {
      japanese: {
        prompts: ["audio"],
        responses: ["definition"],
        answers: ["mc"],
      },
      sentence: { prompts: [], responses: [], answers: [] },
      english: { answers: [] },
    };
    const forms = enabledFormsFor(grammarFact, audioOnly);
    assert.deepEqual(forms, [], "Grammar meaning with audio should produce no forms");
  });

  test("kana audio is silently dropped (kana not listenable)", () => {
    const kanaChar = kanaFact("あ");
    const audioOnly: AskConfig = {
      japanese: {
        prompts: ["audio"],
        responses: ["romaji"],
        answers: ["mc"],
      },
      sentence: { prompts: [], responses: [], answers: [] },
      english: { answers: [] },
    };
    const forms = enabledFormsFor(kanaChar, audioOnly);
    assert.deepEqual(forms, [], "Kana with audio should produce no forms");
  });

  test("kanji reading audio is silently dropped (kanji reading not listenable)", () => {
    const firstKanjiReading = READING_INDEX.keys().next().value;
    assert.ok(firstKanjiReading, "expected at least one kanji reading fact");
    const audioOnly: AskConfig = {
      japanese: {
        prompts: ["audio"],
        responses: ["romaji"],
        answers: ["mc"],
      },
      sentence: { prompts: [], responses: [], answers: [] },
      english: { answers: [] },
    };
    const forms = enabledFormsFor(firstKanjiReading, audioOnly);
    assert.deepEqual(forms, [], "Kanji reading with audio should produce no forms");
  });

  test("sentence romaji is silently dropped (not yet implemented)", () => {
    const wordReading = wordReadingFactId(word.keb);
    const sentenceRomajiOnly: AskConfig = {
      japanese: { prompts: [], responses: [], answers: [] },
      sentence: {
        prompts: ["text", "audio"],
        responses: ["romaji"],
        answers: ["typed", "mc"],
      },
      english: { answers: [] },
    };
    const forms = enabledFormsFor(wordReading, sentenceRomajiOnly);
    assert.deepEqual(forms, [], "Sentence romaji should produce no forms");
  });
});

describe("Multiple settings paths to same question format (text vs audio as different FORMS)", () => {
  test("word reading can be reached via text prompt", () => {
    const textOnly: AskConfig = {
      japanese: {
        prompts: ["text"],
        responses: ["romaji"],
        answers: ["typed"],
      },
      sentence: { prompts: [], responses: [], answers: [] },
      english: { answers: [] },
    };
    const forms = enabledFormsFor(reading, textOnly);
    assert.equal(forms.length, 1);
    assert.deepEqual(forms[0], {
      source: "japanese",
      response: "romaji",
      listen: false,
      dir: "jp2en",
      answer: "typed",
    });
  });

  test("word reading can be reached via audio prompt (creates different FORM)", () => {
    const audioOnly: AskConfig = {
      japanese: {
        prompts: ["audio"],
        responses: ["romaji"],
        answers: ["typed"],
      },
      sentence: { prompts: [], responses: [], answers: [] },
      english: { answers: [] },
    };
    const forms = enabledFormsFor(reading, audioOnly);
    assert.equal(forms.length, 1);
    assert.deepEqual(forms[0], {
      source: "japanese",
      response: "romaji",
      listen: true,
      dir: "jp2en",
      answer: "typed",
    });
  });

  test("word reading deduped when both text and audio selected", () => {
    const both: AskConfig = {
      japanese: {
        prompts: ["text", "audio"],
        responses: ["romaji"],
        answers: ["typed"],
      },
      sentence: { prompts: [], responses: [], answers: [] },
      english: { answers: [] },
    };
    const forms = enabledFormsFor(reading, both);
    assert.equal(forms.length, 2, "Text and audio are different FORMS");
    assert.deepEqual(forms.map((f) => f.listen), [false, true]);
  });

  test("word meaning can be reached via text or audio (creates different FORMS)", () => {
    const textOnly: AskConfig = {
      japanese: {
        prompts: ["text"],
        responses: ["definition"],
        answers: ["mc"],
      },
      sentence: { prompts: [], responses: [], answers: [] },
      english: { answers: [] },
    };
    const audioOnly: AskConfig = {
      ...textOnly,
      japanese: { ...textOnly.japanese, prompts: ["audio"] },
    };
    const textForms = enabledFormsFor(meaning, textOnly);
    const audioForms = enabledFormsFor(meaning, audioOnly);
    assert.equal(textForms.length, 1);
    assert.equal(audioForms.length, 1);
    assert.equal(textForms[0].listen, false);
    assert.equal(audioForms[0].listen, true);
  });

  test("grammar sentence definition can be reached via text or audio (creates different FORMS)", () => {
    const grammarFact = patternMeaningFactId(RECIPES[0].id);
    const textOnly: AskConfig = {
      japanese: { prompts: [], responses: [], answers: [] },
      sentence: {
        prompts: ["text"],
        responses: ["definition"],
        answers: ["mc"],
      },
      english: { answers: [] },
    };
    const audioOnly: AskConfig = {
      ...textOnly,
      sentence: { ...textOnly.sentence, prompts: ["audio"] },
    };
    const textForms = enabledFormsFor(grammarFact, textOnly);
    const audioForms = enabledFormsFor(grammarFact, audioOnly);
    assert.equal(textForms.length, 1);
    assert.equal(audioForms.length, 1);
    assert.equal(textForms[0].listen, false);
    assert.equal(audioForms[0].listen, true);
  });
});

describe("Blocked production facts (not yet implemented)", () => {
  test("keigo production via English not generated (awaiting implementation)", () => {
    // Keigo production facts don't exist in current data model;
    // this test documents that when they do, they should be blocked.
    // For now, we verify that sentence source with non-grammar facts
    // produces no forms.
    const wordMeaning = wordMeaningFactId(word.keb);
    const enToJp: AskConfig = {
      japanese: { prompts: [], responses: [], answers: [] },
      sentence: {
        prompts: ["text"],
        responses: ["definition"],
        answers: ["mc"],
      },
      english: { answers: ["mc"] },
    };
    const forms = enabledFormsFor(wordMeaning, enToJp);
    // Sentence source only emits for grammar meaning facts, so word facts get no sentence forms.
    assert.equal(
      forms.filter((f) => f.source === "sentence").length,
      0,
      "Sentence source should not emit for non-grammar facts",
    );
  });
});

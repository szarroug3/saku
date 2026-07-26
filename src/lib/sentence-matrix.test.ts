import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  ASSEMBLY,
  canonicalOrder,
  gradeAssembly,
} from "@/data/assembly";
import {
  grammarMeaning,
} from "@/data/grammar";
import { VOCAB, wordMeaningFactId } from "@/data/vocab";
import {
  englishSentenceAsksOrdering,
  englishSentenceAsksSelection,
} from "@/lib/ask-config";
import { enabledFormsFor, formIsMc } from "@/lib/ask-forms";
import {
  boardIsUnambiguous,
  gradeRecognition,
  pickRecognition,
} from "@/lib/listen-sentence";
import { ALL_FACTS } from "@/lib/facts";
import type { AskConfig, HistoryFile } from "@/types";

const sentenceAsk = (
  overrides: Partial<AskConfig["sentence"]> = {},
): AskConfig => ({
  japanese: { prompts: [], responses: [], answers: [] },
  sentence: {
    prompts: ["text", "audio"],
    responses: ["definition"],
    answers: ["typed", "mc"],
    englishResponses: [],
    ...overrides,
  },
  english: { answers: [] },
});

const grammarMeanings = ALL_FACTS.filter((fact) => grammarMeaning(fact));

const ALL_KNOWN: HistoryFile = {
  sessions: [],
  facts: {},
  claims: Object.fromEntries(
    VOCAB.map((word) => [wordMeaningFactId(word.keb), 1_700_000_000_000]),
  ),
};

describe("question matrix §4: sentences", () => {
  test("Japanese sentence text/audio emits only English-meaning MC", () => {
    assert.ok(grammarMeanings.length > 0);
    for (const fact of grammarMeanings) {
      const forms = enabledFormsFor(fact, sentenceAsk());
      assert.deepEqual(
        forms.map((form) => ({
          source: form.source,
          response: form.response,
          listen: form.listen,
          dir: form.dir,
          control: formIsMc(fact, form) ? "mc" : "typed",
        })),
        [
          {
            source: "sentence",
            response: "definition",
            listen: false,
            dir: "jp2en",
            control: "mc",
          },
          {
            source: "sentence",
            response: "definition",
            listen: true,
            dir: "jp2en",
            control: "mc",
          },
        ],
        fact,
      );
    }
  });

  test("definition stays MC even when the obsolete stored answer is typed-only", () => {
    const fact = grammarMeanings[0];
    const forms = enabledFormsFor(
      fact,
      sentenceAsk({ prompts: ["text"], answers: ["typed"] }),
    );
    assert.equal(forms.length, 1);
    assert.equal(formIsMc(fact, forms[0]), true);
  });

  test("sentence-to-kana transcription and visible self-copy emit no forms", () => {
    const transcription = sentenceAsk({
      responses: ["romaji"],
      answers: ["typed", "mc"],
    });
    for (const fact of ALL_FACTS) {
      assert.equal(
        enabledFormsFor(fact, transcription).some(
          (form) => form.source === "sentence",
        ),
        false,
        fact,
      );
    }
  });

  test("sentence source never attaches to a non-grammar-meaning fact", () => {
    const config = sentenceAsk();
    for (const fact of ALL_FACTS.filter((candidate) => !grammarMeaning(candidate))) {
      assert.equal(
        enabledFormsFor(fact, config).some(
          (form) => form.source === "sentence",
        ),
        false,
        fact,
      );
    }
  });

  test("served Japanese sentence recognition boards are unambiguous and grade by meaning", () => {
    const item = pickRecognition(ALL_KNOWN, () => 0.42);
    assert.ok(item, "full vocabulary should make a sentence board readable");
    assert.equal(boardIsUnambiguous(item), true);
    assert.equal(gradeRecognition(item, item.correct), true);
    for (let i = 0; i < item.options.length; i++) {
      assert.equal(gradeRecognition(item, i), i === item.correct);
    }
  });

  test("every English ordering item accepts only its canonical chunk order", () => {
    assert.ok(ASSEMBLY.length > 0);
    for (const item of ASSEMBLY) {
      const canonical = [...canonicalOrder(item)];
      assert.equal(gradeAssembly(item, canonical), true, String(item.id));
      if (canonical.length > 1) {
        const wrong = canonical.slice();
        [wrong[0], wrong[1]] = [wrong[1], wrong[0]];
        if (wrong.join("") !== canonical.join("")) {
          assert.equal(gradeAssembly(item, wrong), false, String(item.id));
        }
      }
      assert.equal(gradeAssembly(item, []), false, String(item.id));
    }
  });

  test("ordering and planned selection remain independent settings", () => {
    const ordering = sentenceAsk({ englishResponses: ["ordering"] });
    const selection = sentenceAsk({ englishResponses: ["selection"] });
    assert.equal(englishSentenceAsksOrdering(ordering), true);
    assert.equal(englishSentenceAsksSelection(ordering), false);
    assert.equal(englishSentenceAsksOrdering(selection), false);
    assert.equal(englishSentenceAsksSelection(selection), true);

    // The drill-form generator owns Japanese sentence recognition only.
    // Neither English response may manufacture a typed translation card.
    for (const config of [ordering, selection]) {
      for (const fact of ALL_FACTS.slice(0, 500)) {
        const englishSentenceForms = enabledFormsFor(fact, config).filter(
          (form) => form.source === "sentence" && form.dir === "en2jp",
        );
        assert.deepEqual(englishSentenceForms, [], fact);
      }
    }
  });
});

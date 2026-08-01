import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  GRAMMAR_SUBJECT,
  grammarMeaning,
  grammarProduction,
} from "@/data/grammar";
import { RECIPES } from "@/data/grammar/recipes";
import { enabledFormsFor, formIsMc } from "@/lib/ask-forms";
import { buildMcOptions, checkTyped } from "@/lib/engine";
import {
  answerIsJapanese,
  questionsFor,
} from "@/lib/engine/question";
import { ALL_FACTS, factInfo } from "@/lib/facts";
import type { AskConfig, FactId } from "@/types";

const GRAMMAR_ONLY: AskConfig = {
  japanese: {
    prompts: ["text", "audio"],
    responses: ["definition", "romaji"],
    answers: ["typed", "mc"],
  },
  sentence: {
    prompts: [],
    responses: [],
    answers: [],
    englishResponses: [],
  },
  english: { answers: ["typed", "mc"] },
};

const grammarFacts = ALL_FACTS.filter(
  (fact) => factInfo(fact)?.subject === GRAMMAR_SUBJECT,
);
const meanings = grammarFacts.filter((fact) => grammarMeaning(fact));
const productions = grammarFacts.filter((fact) => grammarProduction(fact));

function shape(fact: FactId) {
  // DISTINCT card shapes. Conjugation classes are distinct facts, while this
  // helper asks only which presentation shapes any one fact supports.
  const seen = new Set<string>();
  const out: Array<{
    source: string;
    response: string;
    listen: boolean;
    dir: string;
    control: string;
  }> = [];
  for (const form of enabledFormsFor(fact, GRAMMAR_ONLY)) {
    const s = {
      source: form.source,
      response: form.response,
      listen: form.listen,
      dir: form.dir,
      control: formIsMc(fact, form) ? "mc" : "typed",
    };
    const key = `${s.source}|${s.response}|${s.listen}|${s.dir}|${s.control}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(s);
  }
  return out;
}

describe("question matrix §5: grammar", () => {
  test("every pattern definition is multiple choice in both directions", () => {
    assert.ok(meanings.length > 0);
    for (const fact of meanings) {
      assert.deepEqual(
        shape(fact),
        [
          {
            source: "japanese",
            response: "definition",
            listen: false,
            dir: "jp2en",
            control: "mc",
          },
          {
            source: "english",
            response: "japanese",
            listen: false,
            dir: "en2jp",
            control: "mc",
          },
        ],
        fact,
      );
    }
  });

  test("reverse meaning recall can never become typed Japanese translation", () => {
    const englishTyped: AskConfig = {
      japanese: { prompts: [], responses: [], answers: [] },
      sentence: {
        prompts: [],
        responses: [],
        answers: [],
        englishResponses: [],
      },
      english: { answers: ["typed"] },
    };
    for (const fact of meanings) {
      const forms = enabledFormsFor(fact, englishTyped);
      assert.equal(forms.length, 1, fact);
      assert.equal(formIsMc(fact, forms[0]), true, fact);
      assert.equal(forms[0].dir, "en2jp", fact);
    }
  });

  test("every production fact has only text-vehicle typed/MC production", () => {
    assert.ok(productions.length > 0);
    for (const fact of productions) {
      assert.equal(answerIsJapanese(fact, "jp2en"), true, fact);
      assert.deepEqual(
        shape(fact),
        [
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
            listen: false,
            dir: "jp2en",
            control: "mc",
          },
        ],
        fact,
      );
    }
  });

  test("grammar audio and production self-copy forms remain absent", () => {
    for (const fact of grammarFacts) {
      assert.equal(
        enabledFormsFor(fact, GRAMMAR_ONLY).some((form) => form.listen),
        false,
        fact,
      );
      if (grammarProduction(fact)) {
        assert.equal(
          enabledFormsFor(fact, GRAMMAR_ONLY).some(
            (form) => form.dir === "en2jp",
          ),
          false,
          fact,
        );
      }
    }
  });

  test("meaning prompts and grading use opposite axes", () => {
    for (const fact of meanings) {
      const info = factInfo(fact);
      const meaning = grammarMeaning(fact);
      assert.ok(info && meaning);
      const jpPrompt = questionsFor(fact).prompt(fact, "jp2en");
      const enPrompt = questionsFor(fact).prompt(fact, "en2jp");
      assert.equal(jpPrompt.jp, true, fact);
      assert.equal(enPrompt.jp, false, fact);
      assert.equal(enPrompt.glyph, meaning.recipe.gloss, fact);
      assert.equal(checkTyped(fact, info.answers[0], "jp2en"), true, fact);
      assert.equal(
        checkTyped(fact, meaning.recipe.pattern, "en2jp"),
        true,
        fact,
      );
    }
  });

  test("reverse meaning MC boards are nontrivial and label distinct patterns", () => {
    for (const fact of meanings.slice(0, 100)) {
      const options = buildMcOptions(fact, "en2jp");
      assert.ok(options.length > 1, fact);
      const labels = options.map(
        (option) =>
          questionsFor(fact).optionLabel?.(option, "en2jp") ??
          factInfo(option)?.glyph,
      );
      assert.equal(new Set(labels).size, labels.length, fact);
    }
  });

  test("every documented recipe contributes its registered meaning fact", () => {
    const ids = new Set(
      meanings.map((fact) => grammarMeaning(fact)?.recipe.id),
    );
    for (const recipe of RECIPES) {
      assert.ok(ids.has(recipe.id), recipe.id);
    }
  });
});

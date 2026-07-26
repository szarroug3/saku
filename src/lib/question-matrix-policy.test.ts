import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { enabledFormsFor, formIsMc } from "@/lib/ask-forms";
import { answerIsJapanese, revealFor } from "@/lib/engine/question";
import { ALL_FACTS, factInfo } from "@/lib/facts";
import { isKanaOnly } from "@/lib/romaji";
import type { AskConfig } from "@/types";

const ALL: AskConfig = {
  japanese: {
    prompts: ["text", "audio"],
    responses: ["definition", "romaji"],
    answers: ["typed", "mc"],
  },
  sentence: {
    prompts: ["text", "audio"],
    responses: ["definition"],
    answers: ["typed", "mc"],
    englishResponses: ["ordering", "selection"],
  },
  english: { answers: ["typed", "mc"] },
};

describe("question matrix: cross-section policy", () => {
  test("audio is Japanese-only and only supported subjects emit it", () => {
    const listenable = new Set(["kana", "word", "keigo", "transitivity", "grammar"]);
    for (const fact of ALL_FACTS) {
      for (const form of enabledFormsFor(fact, ALL).filter((f) => f.listen)) {
        assert.notEqual(form.source, "english", fact);
        assert.ok(listenable.has(factInfo(fact)?.subject ?? ""), fact);
        if (factInfo(fact)?.subject === "grammar") {
          assert.equal(form.source, "sentence", fact);
          assert.equal(form.response, "definition", fact);
        }
      }
    }
  });

  test("every typed Japanese answer is kana, never a kanji glyph or romaji", () => {
    for (const fact of ALL_FACTS) {
      for (const form of enabledFormsFor(fact, ALL)) {
        if (formIsMc(fact, form) || !answerIsJapanese(fact, form.dir)) continue;
        const target = revealFor(fact, form.dir);
        assert.ok(target.length > 0, fact);
        const storedKana = factInfo(fact)?.answers.some(isKanaOnly) ?? false;
        assert.equal(
          isKanaOnly(target) || storedKana,
          true,
          `${fact}: ${target}`,
        );
      }
    }
  });

  test("visible Japanese never asks for the same Japanese again", () => {
    for (const fact of ALL_FACTS) {
      const forbidden = enabledFormsFor(fact, ALL).filter(
        (form) =>
          form.source === "japanese" &&
          !form.listen &&
          form.dir === "en2jp",
      );
      assert.deepEqual(forbidden, [], fact);
    }
  });

  test("higher-level tracks never emit direct reading transcription", () => {
    for (const fact of ALL_FACTS) {
      const subject = factInfo(fact)?.subject;
      if (!["keigo", "transitivity"].includes(subject ?? "")) continue;
      const reading = enabledFormsFor(fact, ALL).filter(
        (form) =>
          form.source === "japanese" && form.response !== "definition",
      );
      assert.deepEqual(reading, [], fact);
    }
  });

  test("sentences never emit typed free-form Japanese translation", () => {
    for (const fact of ALL_FACTS) {
      const typedTranslation = enabledFormsFor(fact, ALL).filter(
        (form) =>
          form.source === "sentence" &&
          form.dir === "en2jp" &&
          !formIsMc(fact, form),
      );
      assert.deepEqual(typedTranslation, [], fact);
    }
  });
});

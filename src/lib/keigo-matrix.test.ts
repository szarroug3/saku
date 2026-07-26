import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  KEIGO_FACTS,
  keigoWordInfo,
  productionCue,
} from "@/data/keigo";
import { enabledFormsFor, formIsMc } from "@/lib/ask-forms";
import { buildMcOptions, checkTyped } from "@/lib/engine";
import { questionsFor } from "@/lib/engine/question";
import { speechForFact } from "@/lib/fact-speech";
import type { AskConfig, FactId } from "@/types";

const ALL: AskConfig = {
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

function shape(fact: FactId) {
  return enabledFormsFor(fact, ALL).map((form) => ({
    source: form.source,
    response: form.response,
    listen: form.listen,
    dir: form.dir,
    control: formIsMc(fact, form) ? "mc" : "typed",
  }));
}

describe("question matrix §6.1: Keigo", () => {
  test("every fact exposes exactly text/audio recognition and typed/MC production", () => {
    assert.ok(KEIGO_FACTS.length > 0);
    for (const fact of KEIGO_FACTS) {
      assert.deepEqual(
        shape(fact.id),
        [
          {
            source: "japanese",
            response: "definition",
            listen: false,
            dir: "jp2en",
            control: "mc",
          },
          {
            source: "japanese",
            response: "definition",
            listen: true,
            dir: "jp2en",
            control: "mc",
          },
          {
            source: "english",
            response: "japanese",
            listen: false,
            dir: "en2jp",
            control: "typed",
          },
          {
            source: "english",
            response: "japanese",
            listen: false,
            dir: "en2jp",
            control: "mc",
          },
        ],
        fact.id,
      );
    }
  });

  test("audio always speaks the authoritative stored kana reading", () => {
    for (const fact of KEIGO_FACTS) {
      const info = keigoWordInfo(fact.id);
      assert.ok(info);
      assert.equal(speechForFact(fact), info.word.reading, fact.id);
    }
  });

  test("production cues identify one stored form and typed answers use kana", () => {
    const cues = new Set<string>();
    for (const fact of KEIGO_FACTS) {
      const info = keigoWordInfo(fact.id);
      assert.ok(info);
      const cue = productionCue(info.set, info.word);
      assert.equal(cues.has(cue), false, cue);
      cues.add(cue);
      assert.equal(
        questionsFor(fact.id).prompt(fact.id, "en2jp").glyph,
        cue,
        fact.id,
      );
      assert.equal(
        checkTyped(fact.id, info.word.reading, "en2jp"),
        true,
        fact.id,
      );
    }
  });

  test("production MC boards show distinct written Keigo forms", () => {
    for (const fact of KEIGO_FACTS) {
      const options = buildMcOptions(fact.id, "en2jp");
      assert.ok(options.length > 1, fact.id);
      const labels = options.map(
        (option) =>
          questionsFor(fact.id).optionLabel?.(option, "en2jp") ??
          keigoWordInfo(option)?.word.word,
      );
      assert.ok(labels.includes(keigoWordInfo(fact.id)?.word.word), fact.id);
      assert.equal(new Set(labels).size, labels.length, fact.id);
    }
  });

  test("direct reading and visible-form self-copy are never emitted", () => {
    for (const fact of KEIGO_FACTS) {
      const forms = enabledFormsFor(fact.id, ALL);
      assert.equal(
        forms.some(
          (form) =>
            form.source === "japanese" && form.response !== "definition",
        ),
        false,
        fact.id,
      );
      assert.equal(
        forms.some(
          (form) =>
            form.source === "japanese" &&
            form.dir === "en2jp" &&
            !form.listen,
        ),
        false,
        fact.id,
      );
    }
  });
});

import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  TRANSITIVITY_FACTS,
  transitivitySide,
} from "@/data/transitivity-facts";
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

describe("question matrix §6.2: verb pairs", () => {
  test("every member exposes exactly text/audio role recognition and typed production", () => {
    assert.ok(TRANSITIVITY_FACTS.length > 0);
    for (const fact of TRANSITIVITY_FACTS) {
      // Role recognition stays MC-only (no typed sibling), so both the text and
      // audio jp→en cards survive. Production had a typed and an MC card; the MC
      // one is dropped by Rule B because the kana reading is typeable, leaving a
      // single typed production card.
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
        ],
        fact.id,
      );
    }
  });

  test("audio and typed production use each member's stored kana reading", () => {
    for (const fact of TRANSITIVITY_FACTS) {
      const side = transitivitySide(fact.id);
      assert.ok(side);
      assert.equal(speechForFact(fact), side.reading, fact.id);
      assert.equal(checkTyped(fact.id, side.reading, "en2jp"), true, fact.id);
    }
  });

  test("every board is exactly the pair and both directions have distinct labels", () => {
    for (const fact of TRANSITIVITY_FACTS) {
      const side = transitivitySide(fact.id);
      assert.ok(side);
      for (const dir of ["jp2en", "en2jp"] as const) {
        const options = buildMcOptions(fact.id, dir);
        assert.equal(options.length, 2, `${fact.id} ${dir}`);
        assert.deepEqual(
          new Set(options),
          new Set([fact.id, side.partner]),
          `${fact.id} ${dir}`,
        );
        const labels = options.map((option) =>
          questionsFor(fact.id).optionLabel?.(option, dir),
        );
        assert.equal(new Set(labels).size, 2, `${fact.id} ${dir}`);
      }
    }
  });

  test("direct reading and visible-form self-copy are never emitted", () => {
    for (const fact of TRANSITIVITY_FACTS) {
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

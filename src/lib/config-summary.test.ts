import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { configSummary } from "@/lib/config-summary";
import type { AskConfig, QuizConfig } from "@/types";

const JP: AskConfig = {
  japanese: {
    prompts: ["text"],
    responses: ["definition", "romaji"],
    answers: ["typed"],
  },
  sentence: { prompts: [], responses: [], answers: [] },
  english: { answers: [] },
};

const BASE = {
  mode: "drill",
  ask: JP,
  length: "endless",
  limType: "cov",
  limCount: 50,
} as QuizConfig;

function mk(over: Partial<QuizConfig>): QuizConfig {
  return { ...BASE, ...over };
}

describe("configSummary — source-inferred directions", () => {
  test("Japanese alone names Japanese → English", () => {
    assert.equal(configSummary(BASE), "Japanese → English · Typed · Endless");
  });

  test("English alone names English → Japanese", () => {
    const ask: AskConfig = {
      japanese: { prompts: [], responses: [], answers: [] },
      sentence: { prompts: [], responses: [], answers: [] },
      english: { answers: ["mc"] },
    };
    assert.equal(
      configSummary(mk({ ask })),
      "English → Japanese · Multiple choice · Endless",
    );
  });

  test("both sources collapse to Both directions and pool their formats", () => {
    const ask: AskConfig = {
      ...JP,
      english: { answers: ["mc"] },
    };
    assert.equal(
      configSummary(mk({ ask })),
      "Both directions · Typed / multiple choice · Endless",
    );
  });

  test("an empty setup says so plainly", () => {
    const ask: AskConfig = {
      japanese: { prompts: [], responses: [], answers: [] },
      sentence: { prompts: [], responses: [], answers: [] },
      english: { answers: [] },
    };
    assert.equal(configSummary(mk({ ask })), "Nothing to ask · Endless");
  });

  test("Audio is named when selected", () => {
    const ask: AskConfig = {
      ...JP,
      japanese: { ...JP.japanese, prompts: ["text", "audio"] },
    };
    assert.equal(
      configSummary(mk({ ask })),
      "Japanese → English · Audio · Typed · Endless",
    );
  });
});

describe("configSummary — length and mode", () => {
  test("full coverage uses the editor's own name", () => {
    assert.equal(
      configSummary(mk({ length: "limited", limType: "cov" })),
      "Japanese → English · Typed · Full coverage",
    );
  });

  test("Count states its cap", () => {
    assert.equal(
      configSummary(
        mk({ length: "limited", limType: "count", limCount: 25 }),
      ),
      "Japanese → English · Typed · Limited to 25",
    );
  });

  test("non-drill modes lead with their name", () => {
    assert.equal(
      configSummary(mk({ mode: "pairs" })),
      "Match pairs · Japanese → English · Typed · Endless",
    );
  });
});

import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { askFromAudioPrompts } from "@/lib/ask-config";
import { configSummary } from "@/lib/config-summary";
import type { QuizConfig } from "@/types";

const BASE = {
  mode: "drill",
  audioPrompts: false,
  ask: askFromAudioPrompts(false),
  length: "endless",
  limType: "cov",
  limCount: 50,
} as QuizConfig;

function mk(over: Partial<QuizConfig>): QuizConfig {
  return { ...BASE, ...over };
}

describe("configSummary — prompt format (the one ask knob)", () => {
  test("a plain text drill names its prompt format and length", () => {
    assert.equal(configSummary(BASE), "Text · Endless");
  });

  test("audio prompts add audio to the text label", () => {
    assert.equal(configSummary(mk({ audioPrompts: true })), "Text & audio · Endless");
  });
});

describe("configSummary — length and mode", () => {
  test("full coverage uses the editor's own name", () => {
    assert.equal(
      configSummary(mk({ length: "limited", limType: "cov" })),
      "Text · Full coverage",
    );
  });

  test("Count states its cap", () => {
    assert.equal(
      configSummary(mk({ length: "limited", limType: "count", limCount: 25 })),
      "Text · Limited to 25",
    );
  });

  test("non-drill modes lead with their name and drop the input format", () => {
    assert.equal(configSummary(mk({ mode: "pairs" })), "Match pairs · Endless");
    assert.equal(configSummary(mk({ mode: "grid" })), "Grid · Endless");
  });
});

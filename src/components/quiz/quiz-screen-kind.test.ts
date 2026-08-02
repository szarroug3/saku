import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { defaultAsk } from "../../lib/ask-config.ts";
import type { QuizSnapshot } from "../../lib/quiz-session-types.ts";
import type { FactId } from "../../types/index.ts";
import {
  quizScreenKind,
  type QuizScreenInput,
} from "./quiz-screen-kind.ts";

function input(
  mode: QuizSnapshot["mode"],
  overrides: Partial<QuizScreenInput> = {},
): QuizScreenInput {
  return {
    facts: ["kana:あ" as FactId],
    snapshot: {
      mode,
      ask: defaultAsk(),
      pairResponses: ["definition"],
      gridResponses: ["definition"],
      length: "limited",
      limType: "count",
      limCount: 10,
    },
    ...overrides,
  };
}

describe("quizScreenKind", () => {
  it("keeps each ordinary quiz mode on its own screen", () => {
    for (const mode of [
      "drill",
      "pairs",
      "grid",
      "assembly",
      "substitution",
      "listen-sentence",
    ] as const) {
      assert.equal(quizScreenKind(input(mode)), mode);
    }
  });

  it("preloads assembly for a drill that has entered its sentence phase", () => {
    assert.equal(
      quizScreenKind(input("drill", { runtime: { sentencePhase: true } })),
      "assembly",
    );
  });
});

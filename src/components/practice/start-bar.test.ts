import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { defaultAsk } from "@/lib/ask-config";
import { startIsDisabled } from "@/lib/practice-start";
import type { PairResponse, QuizConfig } from "@/types";

function pairConfig(pairResponses: PairResponse[]) {
  return {
    mode: "pairs",
    ask: defaultAsk(),
    pairResponses,
  } satisfies Pick<QuizConfig, "mode" | "ask" | "pairResponses">;
}

describe("Match-pairs Start availability", () => {
  test("every nonempty pair-type combination can start with selected material", () => {
    const values: PairResponse[] = ["definition", "romaji", "sentence"];
    for (let mask = 1; mask < 1 << values.length; mask += 1) {
      const selected = values.filter((_, index) => mask & (1 << index));
      assert.equal(
        startIsDisabled(pairConfig(selected), 12, 12),
        false,
        selected.join(" + "),
      );
    }
  });

  test("all pair types may be off, but Start is then disabled", () => {
    assert.equal(startIsDisabled(pairConfig([]), 12, 12), true);
  });

  test("empty material disables Start regardless of selected pair types", () => {
    assert.equal(
      startIsDisabled(pairConfig(["definition", "sentence"]), 0, 0),
      true,
    );
  });
});

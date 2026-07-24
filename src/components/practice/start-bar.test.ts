import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { defaultAsk } from "@/lib/ask-config";
import { startIsDisabled } from "@/lib/practice-start";
import type { GridResponse, PairResponse, QuizConfig } from "@/types";

function pairConfig(pairResponses: PairResponse[]) {
  return {
    mode: "pairs",
    ask: defaultAsk(),
    pairResponses,
    gridResponses: ["definition", "romaji"],
  } satisfies Pick<
    QuizConfig,
    "mode" | "ask" | "pairResponses" | "gridResponses"
  >;
}

function gridConfig(gridResponses: GridResponse[]) {
  return {
    mode: "grid",
    ask: defaultAsk(),
    pairResponses: ["definition", "romaji", "sentence"],
    gridResponses,
  } satisfies Pick<
    QuizConfig,
    "mode" | "ask" | "pairResponses" | "gridResponses"
  >;
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

describe("Grid Start availability", () => {
  test("every nonempty response combination can start with matching material", () => {
    const values: GridResponse[] = ["definition", "romaji"];
    for (let mask = 1; mask < 1 << values.length; mask += 1) {
      const selected = values.filter((_, index) => mask & (1 << index));
      assert.equal(
        startIsDisabled(gridConfig(selected), 12, 12),
        false,
        selected.join(" + "),
      );
    }
  });

  test("all response types may be off, but Start is then disabled", () => {
    assert.equal(startIsDisabled(gridConfig([]), 12, 12), true);
  });

  test("no matching material disables Start", () => {
    assert.equal(
      startIsDisabled(gridConfig(["definition"]), 12, 0),
      true,
    );
  });
});

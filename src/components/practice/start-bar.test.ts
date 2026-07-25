import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { defaultAsk } from "@/lib/ask-config";
import { startIsDisabled, getStartButtonReason } from "@/lib/practice-start";
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

// ── getStartButtonReason ──────────────────────────────────────────────────────
// Tests the message text that appears inside a disabled Start button.

/** Minimal drill config: text prompts, definition responses, typed answers. */
const drillCfg = {
  mode: "drill" as const,
  ask: defaultAsk(),
  pairResponses: [] as PairResponse[],
  gridResponses: [] as GridResponse[],
};

/** Drill config with all ask settings cleared (howBroken). */
const emptyAskCfg = {
  ...drillCfg,
  ask: {
    japanese: { prompts: [], responses: [], answers: [] },
    sentence: { prompts: [], responses: [], answers: [] },
    english: { answers: [] },
  },
} satisfies typeof drillCfg;

describe("getStartButtonReason", () => {
  test("nothing selected → selection message", () => {
    const msg = getStartButtonReason(drillCfg, 0, 0);
    assert.equal(msg, "Nothing is selected. Widen the filters above to start.");
  });

  test("drill with no ask settings → howBroken message", () => {
    const msg = getStartButtonReason(emptyAskCfg, 5, 0);
    assert.equal(msg, "Choose at least one complete way to ask in the setup above.");
  });

  test("pairs with no pair responses → howBroken message", () => {
    const msg = getStartButtonReason({ ...drillCfg, mode: "pairs" }, 5, 0);
    assert.equal(msg, "Choose at least one pair type in the setup above.");
  });

  test("grid with no grid responses → howBroken message", () => {
    const msg = getStartButtonReason({ ...drillCfg, mode: "grid" }, 5, 0);
    assert.equal(msg, "Choose at least one Grid response type in the setup above.");
  });

  test("unreachable settings → diagnostic reason from configIsReachable", () => {
    const msg = getStartButtonReason(drillCfg, 5, 0, {
      isReachable: false,
      reason: "Audio selected but no facts are listenable (word-only; kana, kanji, grammar are not)",
    });
    assert.equal(
      msg,
      "Audio selected but no facts are listenable (word-only; kana, kanji, grammar are not)",
    );
  });

  test("unreachable with no reason → generic unreachable message", () => {
    const msg = getStartButtonReason(drillCfg, 5, 0, { isReachable: false });
    assert.equal(
      msg,
      "These settings can't be used with the selected material. Check the 'How to ask' settings above.",
    );
  });

  test("reachable settings but 0 planned → solid facts message", () => {
    const msg = getStartButtonReason(drillCfg, 5, 0, { isReachable: true });
    assert.equal(
      msg,
      "You're solid on all of these for now. Pick another deck to drill something else.",
    );
  });

  test("no reachability passed, 0 planned → solid facts message", () => {
    const msg = getStartButtonReason(drillCfg, 5, 0);
    assert.equal(
      msg,
      "You're solid on all of these for now. Pick another deck to drill something else.",
    );
  });

  test("grid mode, 0 planned → grid-specific message", () => {
    const msg = getStartButtonReason(
      { ...drillCfg, mode: "grid", gridResponses: ["definition"] as GridResponse[] },
      5,
      0,
    );
    assert.equal(msg, "None of the selected material has those Grid response types.");
  });

  test("pairs mode, 0 planned → pairs-specific message", () => {
    const msg = getStartButtonReason(
      { ...drillCfg, mode: "pairs", pairResponses: ["definition"] as PairResponse[] },
      5,
      0,
    );
    assert.equal(
      msg,
      "These don't make a matching board. Pick more so at least one type has two or more pairs.",
    );
  });

  test("valid setup with planned count → null (Start enabled)", () => {
    const msg = getStartButtonReason(drillCfg, 5, 3);
    assert.equal(msg, null);
  });

  test("unreachable takes priority over solid-facts message", () => {
    const msg = getStartButtonReason(drillCfg, 5, 0, {
      isReachable: false,
      reason: "All sources disabled",
    });
    assert.equal(msg, "All sources disabled");
  });
});

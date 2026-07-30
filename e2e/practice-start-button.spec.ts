import { test, expect, STEADY_CFG } from "./helpers/app";

/**
 * Start button availability across all modes and configurations.
 *
 * The Start button is disabled when:
 * 1. count = 0 (no facts selected)
 * 2. howBroken: for Drill, askIsEmpty (all ask sources disabled). Pairs and Grid
 *    used to break on an empty pair/grid response set, but normalizeConfig now
 *    pins pairResponses/gridResponses to the FULL set unconditionally (config
 *    simplification 7271b87), so a stored empty value is discarded and that
 *    branch can no longer be reached from a seed. Pairs/Grid start given facts.
 * 3. nothingToAsk (count > 0 but plannedCount = 0, a budget issue)
 *
 * All other configurations enable the Start button.
 */

// Use hiragana vowels: simple, common, and distinct to easily verify in tests.
const HIRAGANA = ["あ", "い", "う", "え", "お"];
const HIRAGANA_FACTS = HIRAGANA.map((k) => `kana:${k}/reading`);

// Some kanji for testing English and drill modes.
const KANJI_FACTS = ["kanji:亜/meaning", "kanji:唖/meaning"];

// Default drill config with hiragana selected (asking for romaji since kana don't have "definition").
const DRILL_VALID = {
  ...STEADY_CFG,
  mode: "drill",
  ask: {
    japanese: { prompts: ["text"], responses: ["romaji"], answers: ["typed"] },
    sentence: { prompts: [], responses: [], answers: [] },
    english: { answers: [] },
  },
};

// Default pairs config with at least one response type.
const PAIRS_VALID = {
  ...STEADY_CFG,
  mode: "pairs",
  pairResponses: ["definition"],
  gridResponses: ["definition", "romaji"],
  ask: {
    japanese: { prompts: ["text"], responses: ["definition"], answers: ["typed"] },
    sentence: { prompts: [], responses: [], answers: [] },
    english: { answers: [] },
  },
};

// Default grid config with at least one response type.
const GRID_VALID = {
  ...STEADY_CFG,
  mode: "grid",
  pairResponses: ["definition", "romaji", "sentence"],
  gridResponses: ["definition"],
  ask: {
    japanese: { prompts: ["text"], responses: ["definition"], answers: ["typed"] },
    sentence: { prompts: [], responses: [], answers: [] },
    english: { answers: [] },
  },
};

// Drill with all ask sources disabled (invalid).
const DRILL_INVALID_EMPTY_ASK = {
  ...STEADY_CFG,
  mode: "drill",
  ask: {
    japanese: { prompts: [], responses: [], answers: [] },
    sentence: { prompts: [], responses: [], answers: [] },
    english: { answers: [] },
  },
};

// Pairs with an empty stored pairResponses. normalizeConfig discards this and
// pins the full set, so it is NOT invalid any more; Start still starts.
const PAIRS_EMPTY_RESPONSES = {
  ...STEADY_CFG,
  mode: "pairs",
  pairResponses: [],
  gridResponses: ["definition", "romaji"],
  ask: {
    japanese: { prompts: ["text"], responses: ["definition"], answers: ["typed"] },
    sentence: { prompts: [], responses: [], answers: [] },
    english: { answers: [] },
  },
};

// Grid with an empty stored gridResponses. normalizeConfig discards this and
// pins the full set, so it is NOT invalid any more; Start still starts.
const GRID_EMPTY_RESPONSES = {
  ...STEADY_CFG,
  mode: "grid",
  pairResponses: ["definition", "romaji", "sentence"],
  gridResponses: [],
  ask: {
    japanese: { prompts: ["text"], responses: ["definition"], answers: ["typed"] },
    sentence: { prompts: [], responses: [], answers: [] },
    english: { answers: [] },
  },
};

test.describe("Practice: Start button availability", () => {
  test.describe("Drill mode", () => {
    test("Start is enabled when Japanese source is selected", async ({
      page,
      seed,
    }) => {
      await seed({
        seen: HIRAGANA_FACTS,
        cfg: DRILL_VALID,
      });
      await page.goto("/practice");
      const startButton = page.locator("button:has-text('Start')");
      await expect(startButton).not.toBeDisabled();
    });

    test("Start is disabled when all sources are disabled (askIsEmpty)", async ({
      page,
      seed,
    }) => {
      await seed({
        seen: HIRAGANA_FACTS,
        cfg: DRILL_INVALID_EMPTY_ASK,
      });
      await page.goto("/practice");
      const startButton = page.locator("button:has-text('Start')");
      await expect(startButton).toBeDisabled();
    });

    test("Start is disabled when no facts are selected", async ({ page, seed }) => {
      await seed({
        seen: [],
        cfg: DRILL_VALID,
      });
      await page.goto("/practice");
      const startButton = page.locator("button:has-text('Start')");
      await expect(startButton).toBeDisabled();
    });
  });

  test.describe("Match pairs mode", () => {
    test("Start is enabled when at least one pair response is selected", async ({
      page,
      seed,
    }) => {
      await seed({
        seen: HIRAGANA_FACTS,
        cfg: PAIRS_VALID,
      });
      await page.goto("/practice");
      const startButton = page.locator("button:has-text('Start')");
      await expect(startButton).not.toBeDisabled();
    });

    test("Start is enabled with multiple pair responses selected", async ({
      page,
      seed,
    }) => {
      await seed({
        seen: HIRAGANA_FACTS,
        cfg: {
          ...PAIRS_VALID,
          pairResponses: ["definition", "romaji", "sentence"],
        },
      });
      await page.goto("/practice");
      const startButton = page.locator("button:has-text('Start')");
      await expect(startButton).not.toBeDisabled();
    });

    test("Start stays enabled when the stored pair responses are empty (full set is pinned)", async ({
      page,
      seed,
    }) => {
      // Match-pairs no longer has a per-mode response chooser: normalizeConfig
      // pins pairResponses to the full set, so a stored empty value is discarded
      // and Start still starts given facts. Was: empty pairResponses disabled Start.
      await seed({
        seen: HIRAGANA_FACTS,
        cfg: PAIRS_EMPTY_RESPONSES,
      });
      await page.goto("/practice");
      const startButton = page.locator("button:has-text('Start')");
      await expect(startButton).not.toBeDisabled();
    });

    test("Start is disabled when no facts are selected", async ({ page, seed }) => {
      await seed({
        seen: [],
        cfg: PAIRS_VALID,
      });
      await page.goto("/practice");
      const startButton = page.locator("button:has-text('Start')");
      await expect(startButton).toBeDisabled();
    });
  });

  test.describe("Grid mode", () => {
    test("Start is enabled when at least one grid response is selected", async ({
      page,
      seed,
    }) => {
      await seed({
        seen: HIRAGANA_FACTS,
        cfg: GRID_VALID,
      });
      await page.goto("/practice");
      const startButton = page.locator("button:has-text('Start')");
      await expect(startButton).not.toBeDisabled();
    });

    test("Start is enabled with multiple grid responses selected", async ({
      page,
      seed,
    }) => {
      await seed({
        seen: HIRAGANA_FACTS,
        cfg: {
          ...GRID_VALID,
          gridResponses: ["definition", "romaji"],
        },
      });
      await page.goto("/practice");
      const startButton = page.locator("button:has-text('Start')");
      await expect(startButton).not.toBeDisabled();
    });

    test("Start stays enabled when the stored grid responses are empty (full set is pinned)", async ({
      page,
      seed,
    }) => {
      // Grid pins gridResponses to the full set the same way, so a stored empty
      // value is discarded and Start still starts given facts. Was: empty
      // gridResponses disabled Start.
      await seed({
        seen: HIRAGANA_FACTS,
        cfg: GRID_EMPTY_RESPONSES,
      });
      await page.goto("/practice");
      const startButton = page.locator("button:has-text('Start')");
      await expect(startButton).not.toBeDisabled();
    });

    test("Start is disabled when no facts are selected", async ({ page, seed }) => {
      await seed({
        seen: [],
        cfg: GRID_VALID,
      });
      await page.goto("/practice");
      const startButton = page.locator("button:has-text('Start')");
      await expect(startButton).toBeDisabled();
    });
  });

  test.describe("Edge cases", () => {
    test("Start is enabled when English is selected (even with typed answer format)", async ({
      page,
      seed,
    }) => {
      // English facts should generate forms, even if they can only be typed as MC.
      // The form intent (typed) resolves to MC when necessary, but the fact still appears.
      await seed({
        seen: KANJI_FACTS,
        cfg: {
          ...STEADY_CFG,
          mode: "drill",
          ask: {
            japanese: { prompts: [], responses: [], answers: [] },
            sentence: { prompts: [], responses: [], answers: [] },
            english: { answers: ["typed"] },
          },
        },
      });
      await page.goto("/practice");
      const startButton = page.locator("button:has-text('Start')");
      await expect(startButton).not.toBeDisabled();
    });
  });

  test.describe("Disabled reason messages", () => {
    test("Shows 'Nothing is selected' when count is 0", async ({
      page,
      seed,
    }) => {
      await seed({
        seen: [],
        cfg: DRILL_VALID,
      });
      await page.goto("/practice");
      await expect(page.locator("text=Nothing is selected")).toBeVisible();
    });

    test("Drill with no ask sources shows disabled reason", async ({
      page,
      seed,
    }) => {
      await seed({
        seen: HIRAGANA_FACTS,
        cfg: DRILL_INVALID_EMPTY_ASK,
      });
      await page.goto("/practice");
      const startButton = page.locator("button:has-text('Start')");
      await expect(startButton).toBeDisabled();
    });

    test("Pairs with no facts shows 'Nothing is selected'", async ({
      page,
      seed,
    }) => {
      // The empty-pair-responses reason is gone (responses are pinned full). The
      // reachable pairs disabled reason now is an empty selection: no facts means
      // no playable board, questionCount is 0, so the bar says nothing is selected.
      await seed({
        seen: [],
        cfg: PAIRS_VALID,
      });
      await page.goto("/practice");
      await expect(page.locator("text=Nothing is selected")).toBeVisible();
    });

    test("Grid with no facts shows 'Nothing is selected'", async ({
      page,
      seed,
    }) => {
      // Likewise for Grid: with no facts selected, gridFacts is empty and the
      // reachable disabled reason is the empty selection, not any response set.
      await seed({
        seen: [],
        cfg: GRID_VALID,
      });
      await page.goto("/practice");
      await expect(page.locator("text=Nothing is selected")).toBeVisible();
    });
  });

  test.describe("Multiple source combinations (drill)", () => {
    test("Start is enabled with Japanese + Sentence", async ({ page, seed }) => {
      await seed({
        seen: HIRAGANA_FACTS,
        cfg: {
          ...STEADY_CFG,
          mode: "drill",
          ask: {
            japanese: { prompts: ["text"], responses: ["romaji"], answers: ["typed"] },
            sentence: { prompts: ["text"], responses: ["definition"], answers: ["typed"] },
            english: { answers: [] },
          },
        },
      });
      await page.goto("/practice");
      const startButton = page.locator("button:has-text('Start')");
      await expect(startButton).not.toBeDisabled();
    });
  });
});

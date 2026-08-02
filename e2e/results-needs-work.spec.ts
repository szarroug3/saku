import { test, expect } from "./helpers/app";

/**
 * Regression: results summary and Needs work board must agree.
 *
 * A stored session can have per-fact miss counts but no phrase-level
 * missedPhrases list (older/inferred payloads). The summary computes
 * "things need another pass" from misses; the board must still show those facts
 * in Needs work instead of reading as empty.
 */

test("results shows Needs work rows when summary reports another pass", async ({
  page,
}) => {
  const payload = {
    mode: "grid",
    redrill: false,
    ts: Date.now(),
    stats: {
      "kana:ちゅ/reading": {
        seen: 1,
        misses: 1,
        everCorrect: true,
        firstTryCorrect: false,
        firstTryCount: 0,
        correct: 1,
        confused: {},
      },
      "kana:あ/reading": {
        seen: 1,
        misses: 0,
        everCorrect: true,
        firstTryCorrect: true,
        firstTryCount: 1,
        correct: 1,
        confused: {},
      },
    },
    summaryOnly: { forgivingPct: 100, strictPct: 50 },
  };

  await page.addInitScript((body: string) => {
    window.localStorage.setItem("saku-session", body);
  }, JSON.stringify({ results: payload }));

  await page.goto("/results");
  await expect(page).toHaveURL(/\/results$/);

  // Summary reports the miss bucket.
  await expect(
    page.getByRole("heading", { name: "Results" }),
  ).toBeVisible();
  await expect(page.getByText(/1 thing needs another pass/)).toBeVisible();

  // Needs work board is not empty; the missed fact's row/cell is present and
  // selected by default.
  await expect(page.getByText("Needs work · 1 selected")).toBeVisible();
  await expect(page.getByText("ちゅ").first()).toBeVisible();

  // Redrill count matches the seeded selection and does not collapse to zero.
  await expect(page.getByRole("button", { name: /Redrill 1 selected/ })).toBeVisible();
});

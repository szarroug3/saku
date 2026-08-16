import { test, expect } from "./helpers/app";

/**
 * Regression: the Needs work board must populate from misses even when the
 * run's headline reads as fully landed.
 *
 * A stored session can have per-fact miss counts but no phrase-level
 * missedPhrases list (older/inferred payloads). The board falls back to
 * misses when missedPhrases is absent; it must still show those facts
 * instead of reading as empty, even though a fact that was eventually
 * correct no longer drives the headline's "needs another pass" wording.
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

  // The fact was landed (via retry), so the run reads as "everything landed
  // in the end" rather than "needs another pass" — but the retry still cost
  // it a spot on the Needs work board below (misses-based, not score-based).
  await expect(
    page.getByRole("heading", { name: "Results" }),
  ).toBeVisible();
  await expect(page.getByText(/Everything landed in the end/)).toBeVisible();

  // Needs work board is not empty; the missed fact's row/cell is present and
  // selected by default.
  await expect(page.getByText("Needs work · 1 selected")).toBeVisible();
  await expect(page.getByText("ちゅ").first()).toBeVisible();

  // Redrill count matches the seeded selection and does not collapse to zero.
  await expect(page.getByRole("button", { name: /Redrill 1 selected/ })).toBeVisible();
});

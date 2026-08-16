import { test, expect } from "./helpers/app";

/**
 * Regression: clearing a pair in "Making progress" must keep the row on
 * screen, tagged Cleared — it must not disappear.
 *
 * "Clear now" stamps `clearedMixups[key]` to now, which makes every prior run
 * for that pair predate the marker. Once history re-renders with that stamp,
 * the pair's whole record is empty (never mixed up, as far as the marker is
 * concerned), so `analyzeRun` stops producing a row for it at all — nothing
 * like the natural "cleared" state. Without a snapshot to fall back to, the
 * row would flicker out the instant the optimistic write lands.
 */

function detail(over: Partial<{
  seen: number;
  misses: number;
  everCorrect: boolean;
  firstTryCorrect: boolean;
  firstTryCount: number;
  correct: number;
  confused: Record<string, number>;
}> = {}) {
  return {
    seen: 1,
    misses: 0,
    everCorrect: true,
    firstTryCorrect: true,
    firstTryCount: 1,
    correct: 1,
    confused: {},
    ...over,
  };
}

test("clearing a progress pair keeps its row visible with the Cleared tag", async ({
  page,
}) => {
  const ts = Date.now();
  const A = "kana:あ/reading";
  const O = "kana:お/reading";

  const results = {
    mode: "drill",
    redrill: false,
    ts,
    stats: {
      [A]: detail(),
      [O]: detail(),
    },
  };

  // あ↔お was mixed up once, then two clean qualifying runs — an open
  // "improving" record, short of the 10-run graduation threshold.
  const priorHistory = {
    sessions: [
      {
        ts: ts - 3 * 60_000,
        mode: "drill",
        redrill: false,
        total: 1,
        forgivingPct: 0,
        strictPct: 0,
        facts: {},
        detail: { [A]: detail({ misses: 1, firstTryCorrect: false, confused: { "kana:お": 1 } }) },
      },
      {
        ts: ts - 2 * 60_000,
        mode: "drill",
        redrill: false,
        total: 2,
        forgivingPct: 100,
        strictPct: 100,
        facts: {},
        detail: { [A]: detail(), [O]: detail() },
      },
      {
        ts: ts - 1 * 60_000,
        mode: "drill",
        redrill: false,
        total: 2,
        forgivingPct: 100,
        strictPct: 100,
        facts: {},
        detail: { [A]: detail(), [O]: detail() },
      },
    ],
    facts: {},
  };

  await page.addInitScript(
    (v: { session: string; history: string }) => {
      window.localStorage.setItem("saku-session", v.session);
      window.localStorage.setItem("saku-local-history", v.history);
    },
    {
      session: JSON.stringify({ results }),
      history: JSON.stringify(priorHistory),
    },
  );

  await page.goto("/results");
  await expect(page).toHaveURL(/\/results$/);

  const pair = page
    .locator("span.min-w-\\[112px\\]")
    .filter({ hasText: "あ" })
    .filter({ hasText: "お" });
  await expect(pair).toBeVisible();
  await expect(page.getByText("No mix-up this run")).toBeVisible();

  const clearBtn = page.getByRole("button", { name: "Clear now", exact: true });
  await expect(clearBtn).toBeVisible();
  await clearBtn.click();

  // Must stay visible and tagged Cleared, both immediately and once the
  // optimistic write's follow-up revalidation has had time to land.
  await expect(pair).toBeVisible();
  await expect(page.getByText("Cleared")).toBeVisible();
  await page.waitForTimeout(400);
  await expect(pair).toBeVisible();
  await expect(page.getByText("Cleared")).toBeVisible();
  await expect(clearBtn).toHaveCount(0);
});

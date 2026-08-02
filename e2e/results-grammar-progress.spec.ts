import { test, expect } from "./helpers/app";

import {
  classProductionFactId,
  patternProductionFactId,
  specialVerbProductionFactId,
} from "@/data/grammar";
import { wordMeaningFactId } from "@/data/vocab";

function runDetail(over: Partial<{
  seen: number;
  misses: number;
  everCorrect: boolean;
  firstTryCorrect: boolean;
  firstTryCount: number;
  correct: number;
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

test("results shows grammar split rows, label formatting, making-progress status and pips", async ({
  page,
}) => {
  const ts = Date.now();

  const teGodanU = classProductionFactId("te-sequence", "v5u");
  const teIchidan = classProductionFactId("te-sequence", "v1");
  const teIrregularKuru = specialVerbProductionFactId("te-sequence", "kuru");
  const teIrregularIku = specialVerbProductionFactId("te-sequence", "iku");
  const teAdjNa = patternProductionFactId("te-sequence", "adj-na");

  const results = {
    mode: "drill",
    redrill: false,
    ts,
    stats: {
      [teGodanU]: runDetail({
        seen: 2,
        misses: 1,
        everCorrect: true,
        firstTryCorrect: false,
        firstTryCount: 1,
        correct: 2,
      }),
      [teIchidan]: runDetail({
        seen: 1,
        misses: 1,
        everCorrect: false,
        firstTryCorrect: false,
        firstTryCount: 0,
        correct: 0,
      }),
      [teIrregularKuru]: runDetail({
        seen: 1,
        misses: 1,
        everCorrect: false,
        firstTryCorrect: false,
        firstTryCount: 0,
        correct: 0,
      }),
      [teIrregularIku]: runDetail({
        seen: 1,
        misses: 1,
        everCorrect: false,
        firstTryCorrect: false,
        firstTryCount: 0,
        correct: 0,
      }),
      [teAdjNa]: runDetail({
        seen: 1,
        misses: 0,
        everCorrect: true,
        firstTryCorrect: true,
        firstTryCount: 1,
        correct: 1,
      }),
    },
  };

  const priorSessions = [
    { firstTry: true },
    { firstTry: true },
    { firstTry: true },
    { firstTry: true },
    { firstTry: true },
    { firstTry: false },
    { firstTry: false },
  ].map((r, i) => ({
    ts: ts - (i + 2) * 60_000,
    mode: "drill",
    redrill: false,
    total: 1,
    forgivingPct: 100,
    strictPct: r.firstTry ? 100 : 0,
    facts: {
      [teAdjNa]: {
        seen: 1,
        missed: r.firstTry ? 0 : 1,
        firstTry: r.firstTry ? 1 : 0,
        correct: 1,
        firstTryHit: r.firstTry,
      },
    },
  }));

  // Prior history: marks teAdjNa as "getting there" before this run so it
  // appears in Making progress after a clean run, with a 10-dot pip strip.
  const priorHistory = {
    sessions: priorSessions,
    facts: {},
    seen: {
      // Known irregular: label should show 来る, not くる.
      [wordMeaningFactId("来る")]: ts - 1000,
    },
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

  await expect(page.getByText("Making progress")).toBeVisible();
  await expect(page.getByText("~て · na-adj")).toBeVisible();
  await expect(page.getByText("No miss this run")).toBeVisible();
  await expect(page.getByText(/Currently getting there, \d+ to clear it/)).toBeVisible();
  await expect(page.getByLabel("last ten runs").first().locator("span")).toHaveCount(10);
  // FactProgressSection renders after PatternSection, so its Clear now is last.
  const factClearBtn = page.locator("button").filter({ hasText: "Clear now" }).last();
  await expect(factClearBtn).toBeVisible();
  await factClearBtn.click();
  await expect(factClearBtn).toHaveCount(0);
  await expect(page.getByText("Cleared")).toBeVisible();

  // Grammar rows split by label (not collapsed into one ~て row).
  await expect(page.getByText("~て · godan · う")).toBeVisible();
  await expect(page.getByText("~て · ichidan")).toBeVisible();

  // Irregular labels: known shows kanji/surface, unknown shows kana.
  await expect(page.getByText("~て · irregular · 来る")).toBeVisible();
  await expect(page.getByText("~て · irregular · いく")).toBeVisible();
});

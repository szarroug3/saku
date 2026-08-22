import {
  test,
  expect,
  STEADY_CFG,
  direction,
  style,
  drillReady,
  progressPill,
  answerBox,
} from "./helpers/app";
import { kanaFact } from "@/data/characters";
import { factInfo } from "@/lib/facts";
import type { FactId } from "@/types";

/**
 * SAK-135: RERUN REPLAYS THE FULL ORIGINAL FACTS, NOT JUST WHAT WAS ANSWERED.
 *
 * Rerun and Retry are two different buttons with two different premises (Sam):
 * Retry acts on what you actually did this run (the selected/missed cells),
 * Rerun replays the full facts list that originally started the quiz —
 * regardless of whether you answered anything. `results-view.tsx`'s Rerun
 * sources this from `results.planned` (the run's frozen fact list), not from
 * what got resolved, specifically so it survives a run ended early with
 * facts still unanswered. This is the one thing selection.test.ts's unit
 * coverage can't reach: the actual button, on the actual Results screen.
 */

const VOWELS = ["あ", "い", "う"];
const VOWEL_FACTS = VOWELS.map((c) => kanaFact(c));

const CFG = {
  ...STEADY_CFG,
  ...direction("jp2en"),
  ...style("jp2en", "typed"),
  length: "limited",
  limType: "cov",
};

test("Rerun appears after ending a quiz early and replays every original fact", async ({
  page,
  seed,
}) => {
  await seed({ seen: VOWEL_FACTS, cfg: CFG });

  await page.goto("/practice");
  await page.getByRole("button", { name: "Start", exact: true }).click();
  await page.waitForURL("**/quiz");
  await drillReady(page);
  await expect(progressPill(page)).toHaveText("0 / 3");

  // Answer only the first card, correctly, then end the quiz early — two of
  // the three original facts are never shown at all.
  const glyph = (await page.locator(".kq-glyph").first().innerText()).trim();
  const fact = VOWEL_FACTS.find((f) => factInfo(f as FactId)?.glyph === glyph);
  await answerBox(page).fill(factInfo(fact as FactId)!.answers[0]);
  await answerBox(page).press("Enter");
  await page.getByRole("button", { name: "End quiz", exact: true }).click();
  await page.waitForURL("**/results");

  // Rerun shows even though this run answered only one of the three facts —
  // it is not gated on completion, only on there being an original pool.
  const rerun = page.getByRole("button", { name: "Rerun", exact: true });
  await expect(rerun).toBeVisible();

  await rerun.click();
  await page.waitForURL("**/quiz");
  await drillReady(page);
  // All three original facts, not just the one this run actually answered.
  await expect(progressPill(page)).toHaveText("0 / 3");
});

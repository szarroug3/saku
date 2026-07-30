import {
  test,
  expect,
  STEADY_CFG,
  direction,
  style,
  drillReady,
  progressPill,
  answerBox,
  answerTypedCorrectly,
} from "./helpers/app";
import { factInfo } from "@/lib/facts";
import { kanaFact } from "@/data/characters";
import type { FactId } from "@/types";

/**
 * SAVING A FINISHED SESSION AS A LIST. A run's results screen offers "Save as a
 * list", which stores that session as a list you can drill again. This plays a
 * full-coverage practice run to /results, saves it, and confirms the list shows
 * up on /lists. Signed out; the list lands in this browser's own storage.
 */

const VOWELS = ["あ", "い", "う", "え", "お"];
const VOWEL_FACTS = VOWELS.map((c) => kanaFact(c));

const CFG = {
  ...STEADY_CFG,
  ...direction("jp2en"),
  ...style("jp2en", "typed"),
  length: "limited",
  limType: "cov",
};

test("a finished session can be saved as a list", async ({ page, seed }) => {
  await seed({ seen: VOWEL_FACTS, cfg: CFG });

  // Play a full-coverage run to its results, which commits the session.
  await page.goto("/practice");
  await page.getByRole("button", { name: "Start", exact: true }).click();
  await page.waitForURL("**/quiz");
  await drillReady(page);
  await expect(progressPill(page)).toHaveText("0 / 5");
  for (let i = 1; i < VOWELS.length; i++) {
    await answerTypedCorrectly(page, VOWEL_FACTS, i);
  }
  const glyph = (await page.locator(".kq-glyph").first().innerText()).trim();
  const last = VOWEL_FACTS.find((f) => factInfo(f as FactId)?.glyph === glyph);
  const box = answerBox(page);
  await box.fill(factInfo(last as FactId)!.answers[0]);
  await box.press("Enter");
  await page.waitForURL("**/results");

  // Save this session as a list, then confirm it is in Lists.
  await page.getByRole("button", { name: /Save as a list/i }).click();
  await expect(page.getByRole("button", { name: /Saved as a list/i })).toBeVisible();

  await page.goto("/lists");
  await expect(
    page.getByRole("heading", { name: /^Session / }),
  ).toBeVisible();
});

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
 * THE PRACTICE RUN, END TO END.
 *
 * The practice-selector specs stop at "Start is enabled" — they prove a run CAN
 * begin, never that it plays. This drives the lever they don't: pressing Start on
 * /practice makes a ONE-OFF quiz (startQuiz, not a lesson session), and a finite
 * run of it commits and lands on /results. Signed out, config seeded before the
 * first navigation, no sleeps.
 */

const VOWELS = ["あ", "い", "う", "え", "お"];
const VOWEL_FACTS = VOWELS.map((c) => kanaFact(c));

// A FINITE practice run. STEADY pins endless, which never reaches results, so
// override to a full-coverage limited run: each seeded fact is asked once and the
// quiz then ends. jp2en typed so the answer is the kana's romaji reading, which
// answerTypedCorrectly reads straight off the fact.
const CFG = {
  ...STEADY_CFG,
  ...direction("jp2en"),
  ...style("jp2en", "typed"),
  length: "limited",
  limType: "cov",
};

test("a practice run started from the selector plays through to results", async ({
  page,
  seed,
}) => {
  await seed({ seen: VOWEL_FACTS, cfg: CFG });

  // Start from the Practice selector itself, the way a learner does — not the
  // startPractice helper's shortcut, because the whole point is that THIS page's
  // Start launches a real, playable run.
  await page.goto("/practice");
  const start = page.getByRole("button", { name: "Start", exact: true });
  await expect(start).toBeEnabled();
  await start.click();
  await page.waitForURL("**/quiz");

  await drillReady(page);
  // Full coverage over the five vowels: five questions, none answered yet.
  await expect(progressPill(page)).toHaveText("0 / 5");

  // Answer the first four; each call waits for the next card to be drawn.
  for (let i = 1; i < VOWELS.length; i++) {
    await answerTypedCorrectly(page, VOWEL_FACTS, i);
  }

  // The fifth is the last card: answering it completes the one-off quiz, which
  // commits its record and pushes /results. There is no next card to wait for,
  // so answer it directly and follow the navigation.
  const glyph = (await page.locator(".kq-glyph").first().innerText()).trim();
  const last = VOWEL_FACTS.find((f) => factInfo(f as FactId)?.glyph === glyph);
  const box = answerBox(page);
  await box.fill(factInfo(last as FactId)!.answers[0]);
  await box.press("Enter");

  await page.waitForURL("**/results");
  // The results board rendered for THIS run: its title, and the sub that counts
  // the five questions a full-coverage run over five facts actually asked.
  await expect(page.getByRole("heading", { name: "Results" })).toBeVisible();
  await expect(page.getByText(/5 questions/)).toBeVisible();
});

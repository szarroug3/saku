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
  type Page,
} from "./helpers/app";
import { factInfo } from "@/lib/facts";
import type { FactId } from "@/types";

/**
 * THE SESSION LOOP, ALL THREE ROUNDS.
 *
 * The lesson spec stops when round 1 reports, which is exactly why the session
 * brick (task 14) was invisible: the bug lives in the transition OUT of a
 * round-complete fork and into the next round. This spec plays the whole loop.
 */

const VOWELS = ["あ", "い", "う", "え", "お"];
const VOWEL_FACTS = VOWELS.map((k) => `kana:${k}/reading`);

const CFG = {
  ...STEADY_CFG,
  ...direction("jp2en"),
  ...style("jp2en", "typed"),
  length: "limited",
  limType: "cov",
};

/** Answer every card of a full-coverage round, ending on the last one without
 * waiting for a next card that is never drawn. */
async function playRound(page: Page, size: number) {
  await drillReady(page);
  await expect(progressPill(page)).toHaveText(`0 / ${size}`);
  for (let i = 1; i < size; i++) {
    await answerTypedCorrectly(page, VOWEL_FACTS, i);
  }
  const glyph = (await page.locator(".kq-glyph").first().innerText()).trim();
  const last = VOWEL_FACTS.find((f) => factInfo(f as FactId)?.glyph === glyph);
  const box = answerBox(page);
  await box.fill(factInfo(last as FactId)!.answers[0]);
  await box.press("Enter");
  await page.waitForURL("**/session");
}

/** Walk the teach phase and start the quiz. Day one opens on the hiragana track
 * intro, so the walk is the five vowels plus that one card: VOWELS Next clicks
 * step past the card and the first four vowels. See src/data/track-intros.ts. */
async function teachThenQuiz(page: Page) {
  for (let i = 0; i < VOWELS.length; i++) {
    await page.getByRole("button", { name: "Next", exact: true }).click();
  }
  await page.getByRole("button", { name: "Quiz me", exact: true }).click();
  await page.waitForURL("**/quiz");
}

test("a session plays all three rounds through to Session complete", async ({
  page,
  seed,
}) => {
  const loopErrors: string[] = [];
  page.on("console", (m) => {
    if (m.type() === "error" && /Maximum update depth/.test(m.text())) {
      loopErrors.push(m.text());
    }
  });

  await seed({ seen: [], cfg: CFG });

  await page.goto("/");
  await page.getByRole("button", { name: "Start", exact: true }).click();
  await page.waitForURL("**/session");
  await teachThenQuiz(page);

  for (let round = 1; round <= 3; round++) {
    await playRound(page, VOWELS.length);
    await expect(page.locator("body")).toContainText(
      `round ${round} of 3 · done`,
    );

    if (round < 3) {
      await page
        .getByRole("button", { name: "Complete round", exact: true })
        .click();
      // The rest is a timestamp, not a process; skipping it is a supported door.
      await page.getByRole("button", { name: /^Start (now →|round \d)$/ }).click();
      await page.waitForURL("**/quiz");
    } else {
      await page
        .getByRole("button", { name: "Complete session", exact: true })
        .click();
    }
  }

  await expect(page.locator("body")).toContainText("complete");
  expect(loopErrors).toEqual([]);
});

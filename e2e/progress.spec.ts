import {
  test,
  expect,
  STEADY_CFG,
  direction,
  style,
  startPractice,
  answerBox,
  answeredPill,
  drillReady,
  type Page,
} from "./helpers/app";
import { factInfo } from "@/lib/facts";
import type { FactId } from "@/types";

/**
 * "Progress survives. Refreshing or navigating away mid-quiz must not silently
 * lose work."
 *
 * The quiz snapshots itself — deck, position, stats and the current question —
 * into localStorage under "kanaquiz-session", written on every resolved answer.
 * These tests check that the promise that storage makes is actually kept at the
 * UI level: come back, and the count you had earned is still there.
 */

const POOL = ["あ", "い", "う", "え", "お", "か", "き", "く"].map(
  (k) => `kana:${k}/reading`,
);

const CFG = { ...STEADY_CFG, ...direction("jp2en"), ...style("jp2en", "typed") };

/** The romaji the drill expects for a hiragana glyph, from the app's registry. */
function answerForGlyph(glyph: string): string {
  const fact = POOL.find((f) => factInfo(f as FactId)?.glyph === glyph);
  const answer = fact ? factInfo(fact as FactId)?.answers[0] : undefined;
  if (!answer) throw new Error(`no seeded fact renders the glyph ${glyph}`);
  return answer;
}

/**
 * Answer the card on screen correctly and wait for the next one.
 *
 * Waiting on the old glyph node detaching is exact here: the halo is keyed on
 * `${rt.asked}-${q.tries}` and a CORRECT answer never bumps `tries`, so the
 * remount can only mean the next question was drawn.
 */
async function answerCorrectly(page: Page, expectedTotal: number) {
  const glyphNode = await page.locator(".kq-glyph").first().elementHandle();
  const glyph = (await page.locator(".kq-glyph").first().innerText()).trim();

  const box = answerBox(page);
  await expect(box).toBeVisible();
  await box.fill(answerForGlyph(glyph));
  await box.press("Enter");

  await expect(answeredPill(page)).toHaveText(`${expectedTotal} answered`);
  await page.waitForFunction((el) => !el?.isConnected, glyphNode);
  await glyphNode?.dispose();
}

test("a mid-quiz refresh resumes the quiz instead of losing it", async ({
  page,
  seed,
}) => {
  await seed({ seen: POOL, cfg: CFG });
  await startPractice(page);

  await answerCorrectly(page, 1);
  await answerCorrectly(page, 2);
  await answerCorrectly(page, 3);
  await expect(answeredPill(page)).toHaveText("3 answered");

  await page.reload();

  // Still in the quiz — NOT bounced to setup, which is what /quiz does when it
  // finds no stored session.
  await expect(page).toHaveURL(/\/quiz$/);
  await drillReady(page);
  // ...and the three answers are still counted.
  await expect(answeredPill(page)).toHaveText("3 answered");
});

test("navigating away mid-quiz and coming back keeps the progress", async ({
  page,
  seed,
}) => {
  await seed({ seen: POOL, cfg: CFG });
  await startPractice(page);

  await answerCorrectly(page, 1);
  await answerCorrectly(page, 2);

  // Leave the quiz entirely, by a real in-app navigation rather than a reload.
  await page.getByRole("navigation").getByRole("link", { name: "Library" }).click();
  await expect(page).toHaveURL(/\/library$/);

  await page.goto("/quiz");
  await expect(page).toHaveURL(/\/quiz$/);
  await drillReady(page);
  await expect(answeredPill(page)).toHaveText("2 answered");
});

test("a wrong answer is still counted after a refresh", async ({
  page,
  seed,
}) => {
  await seed({ seen: POOL, cfg: CFG });
  await startPractice(page);

  const box = answerBox(page);
  await box.fill("definitely-not-a-reading");
  await box.press("Enter");
  await expect(answeredPill(page)).toHaveText("1 answered");

  await page.reload();
  await drillReady(page);

  // The miss survives too. This is the case the app's own comments call out as
  // the one that used to be lost, so it is worth asserting separately from the
  // right-answer path.
  await expect(answeredPill(page)).toHaveText("1 answered");
  await expect(page.getByText(/^\d+ re-queued$/)).toHaveText("1 re-queued");
});

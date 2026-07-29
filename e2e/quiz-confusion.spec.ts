import {
  test,
  expect,
  STEADY_CFG,
  direction,
  style,
  answerBox,
} from "./helpers/app";
import { seedQuiz, startQuizDrill } from "./helpers/quiz";

/**
 * A CONFUSION SURFACES ON THE RESULTS SCREEN (task #20).
 *
 * quiz-tells-you.spec already proves a typed miss that names another known entry
 * is CALLED OUT at the reveal. This test proves the other half: that same miss is
 * RECORDED and shows up as a Pattern on the results screen, which is where the
 * app turns a run's confusions into "here's what to work on".
 *
 * あ answered as お is the canonical case — a pair the character data has
 * predicted since it was written. Both kana are seeded so `confusedWith` can
 * resolve the typed answer within the deck; the glyph on screen decides which
 * way round the miss goes.
 */

const JP2EN_TYPED = {
  ...STEADY_CFG,
  ...direction("jp2en"),
  ...style("jp2en", "typed"),
};

test("missing あ with お is reported as a pattern on the results screen", async ({
  page,
}) => {
  await seedQuiz(page, {
    seen: ["kana:あ/reading", "kana:お/reading"],
    cfg: JP2EN_TYPED,
  });
  await startQuizDrill(page);

  const shown = (await page.locator(".kq-glyph").first().innerText()).trim();
  const wrong = shown === "あ" ? "o" : "a";
  const box = answerBox(page);
  await box.fill(wrong);
  await box.press("Enter");
  // The miss has resolved (retries none) and is recorded.
  await expect(page.getByText(/^1 re-queued$/)).toBeVisible();

  // End the run to reach results.
  await page.getByRole("button", { name: "End quiz" }).click();
  await expect(page).toHaveURL(/\/results$/);

  // The Patterns section names the pair and says it happened once this run. The
  // pair is not one text node: pattern-rows.tsx draws each glyph in its own span
  // with a "kana" sublabel beneath and the ↔ in a span between them, so match the
  // pair block (min-w-[112px]) that holds both kana rather than an "あ ↔ お" run.
  await expect(page.getByText("Patterns", { exact: true })).toBeVisible();
  const pair = page
    .locator("span.min-w-\\[112px\\]")
    .filter({ hasText: "あ" })
    .filter({ hasText: "お" });
  await expect(pair).toBeVisible();
  await expect(page.getByText(/^Mixed up once$/)).toBeVisible();
});

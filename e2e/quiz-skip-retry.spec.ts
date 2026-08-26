import {
  test,
  expect,
  STEADY_CFG,
  direction,
  style,
  answerBox,
  answeredPill,
  answeredTextRe,
  requeuedPill,
  reveal,
} from "./helpers/app";
import { seedQuiz, skipButton, startQuizDrill } from "./helpers/quiz";

/**
 * SKIP and RETRIES — the two ways a card can end without being answered right
 * away.
 *
 * SKIP is "not now, come back to it": an untried card costs nothing and is
 * re-queued to the end. RETRIES give a wrong answer another go before the card
 * resolves — the pips count them down, and the card is NOT resolved (answered
 * stays put, no reveal) until the goes run out.
 */

const JP2EN_TYPED = {
  ...STEADY_CFG,
  ...direction("jp2en"),
  ...style("jp2en", "typed"),
};

test("skipping an untried card re-queues it for free and draws the next", async ({
  page,
}) => {
  await seedQuiz(page, {
    seen: ["kana:あ/reading", "kana:い/reading"],
    cfg: JP2EN_TYPED,
  });
  const glyph = await startQuizDrill(page);
  const first = (await glyph.innerText()).trim();

  await expect(skipButton(page)).toBeVisible();
  await skipButton(page).click();

  // A new card is up — the other kana, since the skipped one went to the back.
  await expect(page.locator(".kq-glyph").first()).not.toHaveText(first);
  // The skip re-queued a card but scored nothing: nothing is "answered".
  await expect(requeuedPill(page)).toHaveText("1 re-queued");
  await expect(answeredPill(page)).toHaveText(answeredTextRe(0));
});

test("a retry keeps the card up; only running out of goes resolves it", async ({
  page,
}) => {
  // retryN 1 = two attempts (one real retry): a card locks once tries exceeds
  // retryN, not once tries reaches it. The pips show, and the label names them.
  await seedQuiz(page, {
    seen: ["kana:あ/reading"],
    cfg: {
      ...JP2EN_TYPED,
      retries: "lim",
      retryN: 1,
      showRetryPips: true,
    },
  });
  await startQuizDrill(page);
  await expect(page.getByText("retries")).toBeVisible();

  const box = answerBox(page);
  // First miss: a go is spent, but the card is NOT resolved — still 0 answered,
  // no reveal, the box still open for another attempt.
  await box.fill("zzz");
  await box.press("Enter");
  await expect(answeredPill(page)).toHaveText(answeredTextRe(0));
  await expect(reveal(page).answer).toHaveCount(0);
  await expect(answerBox(page)).toBeVisible();

  // Second miss: out of goes. Now it resolves — answered ticks, it re-queues, and
  // the reveal finally shows the answer.
  await answerBox(page).fill("zzz");
  await answerBox(page).press("Enter");
  await expect(answeredPill(page)).toHaveText(answeredTextRe(1));
  await expect(requeuedPill(page)).toHaveText("1 re-queued");
  await expect(reveal(page).answer).toBeVisible();
});

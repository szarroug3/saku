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
 * LIVE STANDING (task #19): a CLAIMED item stops reading "claimed" the moment you
 * miss it.
 *
 * "I already know this" advances the curriculum but starts UNTESTED, so the
 * Library reads "claimed" — a claim, never tested. The instant you miss it in a
 * drill the app has evidence, and the Library must update immediately rather than
 * on End session (src/lib/library/live-standing.ts folds the in-progress run onto
 * committed history at read time). "claimed" is checked BEFORE anything the
 * arithmetic would pick, so its disappearance is the honest signal the flip
 * happened.
 *
 * The surface is the Library search row for あ, which shows the one adjective an
 * entry is allowed to wear (the StandingChip). Searching the glyph itself narrows
 * to exactly that entry.
 */

const JP2EN_TYPED = {
  ...STEADY_CFG,
  ...direction("jp2en"),
  ...style("jp2en", "typed"),
};

const AT = "/library?kind=kana&q=あ";

test("a claimed kana reads 'claimed' until it is missed, then does not", async ({
  page,
}) => {
  await seedQuiz(page, { claims: ["kana:あ/reading"], cfg: JP2EN_TYPED });

  // Before any drill, the claim reads "claimed" in the Library.
  await page.goto(AT);
  await expect(page.getByText("claimed", { exact: true })).toBeVisible();

  // Drill the claimed card and miss it (retries none, so the miss resolves).
  await startQuizDrill(page);
  const box = answerBox(page);
  await box.fill("definitely-wrong");
  await box.press("Enter");
  await expect(page.getByText(/^1 re-queued$/)).toBeVisible();

  // Back in the Library, the same entry no longer reads "claimed": the live fold
  // has folded the miss onto history, and a fact with a showing behind it cannot
  // be "claimed" anymore.
  await page.goto(AT);
  await expect(page.getByText("あ", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("claimed", { exact: true })).toHaveCount(0);
});

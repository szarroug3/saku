import { test, expect, STEADY_CFG, answerBox, reveal } from "./helpers/app";
import { seedQuiz, ask, startQuizDrill, hintButton } from "./helpers/quiz";

import { specialVerbProductionFactId } from "@/data/grammar";

/**
 * THE TE-FORM'S IRREGULARS, DRILLED BY A LEARNER WHO KNOWS NO KANJI.
 *
 * The bug Sam hit in te-form lesson 1: 行く / する / 来る are the te-form's
 * memorized exceptions, each pinned to exactly that verb, and a day-one learner
 * has met none of them. The vehicle pool had nothing "safe to guess" to offer,
 * returned no vehicle, and the card fell back to its baked KANJI lemma — the
 * prompt read 行く and a miss revealed 行って, both in kanji never taught. And the
 * hint on any te-form production card was "uses the て-form", which on a card that
 * ASKS you to build the て-form is the question restated: a button that did
 * nothing.
 *
 * Seeds the @iku production fact as the only card in the pool (STEADY_CFG is
 * endless, retries-none, showAnswer), so whichever showing is drawn IS 行く's
 * te-form. The unit suite (grammar-question.test.ts, hint.test.ts) pins the same
 * three facts on every irregular; this proves they render in the real drill.
 */
test("the te-form's 行く card is kana, has no dead hint, and reveals both scripts", async ({
  page,
}) => {
  await seedQuiz(page, {
    seen: [specialVerbProductionFactId("te-sequence", "iku")],
    cfg: { ...STEADY_CFG, ...ask({ jpPrompts: ["text"], jpAnswers: ["typed"] }) },
  });
  const glyph = await startQuizDrill(page);

  // 1. The prompt is the kana reading いく, never the kanji 行 the learner has not
  //    met.
  await expect(glyph).toHaveText("いく");

  // 2. The Hint button no longer says "uses the て-form" — that on a card asking
  //    for the て-form IS the prompt restated, so the form recipe's own form
  //    nudge stays silent. But SAK-193 adds a pattern-name line alongside it,
  //    which is not a tautology, so the button is back (naming 〜て) rather than
  //    the total silence this card used to get.
  await hintButton(page).click();
  await expect(page.getByText("This is the 〜て pattern", { exact: true })).toBeVisible();

  // 3. Miss it, and the reveal shows BOTH scripts — both are graded correct, so
  //    hiding one hid a right answer. Kana leads (what she typed), 行って rides
  //    alongside so いって reads unambiguously as 行く.
  const box = answerBox(page);
  await expect(box).toBeVisible();
  await box.fill("ちがう");
  await box.press("Enter");
  await expect(reveal(page).box).toContainText("いって");
  await expect(reveal(page).box).toContainText("行って");
});

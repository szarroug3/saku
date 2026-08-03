import { test, expect, STEADY_CFG, answerBox, reveal } from "./helpers/app";
import { seedQuiz, ask, startQuizDrill, instruction } from "./helpers/quiz";

import { patternProductionFactId } from "@/data/grammar";

/**
 * AN ADJECTIVE FORM CARD, drilled by a learner who has met no adjectives.
 *
 * The newest drill path: forms now conjugate adjectives (高ければ) as their own
 * scored skill. An unknown い-adjective is drawn in KANA (たかい), and because 〜る
 * alone does not say whether a word is an い- or な-adjective, the instruction
 * NAMES the type — "this い-adjective" — so the learner knows the rule to apply.
 * A miss reveals both scripts, since both are graded correct. Seeds 〜ば's adj-i
 * fact as the only card so whichever showing is drawn IS the い-adjective form.
 */
test("an adjective form card is kana, names the い-adjective type, and reveals both scripts", async ({
  page,
}) => {
  await seedQuiz(page, {
    seen: [patternProductionFactId("ba", "adj-i")],
    cfg: { ...STEADY_CFG, ...ask({ jpPrompts: ["text"], jpAnswers: ["typed"] }) },
  });
  const glyph = await startQuizDrill(page);

  // Unknown い-adjective, drawn in kana — never the kanji 高.
  await expect(glyph).toHaveText("たかい");

  // The instruction names the class so the conjugation is not a guess.
  await expect(instruction(page)).toContainText("い-adjective");

  // Miss it → the reveal shows BOTH scripts (both are accepted).
  const box = answerBox(page);
  await expect(box).toBeVisible();
  await box.fill("ちがう");
  await box.press("Enter");
  await expect(reveal(page).box).toContainText("たかければ");
  await expect(reveal(page).box).toContainText("高ければ");
});

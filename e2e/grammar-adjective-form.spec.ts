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
 * A miss reveals the derivation that builds the answer (SAK-194): the base
 * word, its class, and the drop/add equation that gets from one to the other.
 * Seeds 〜ば's adj-i fact as the only card so whichever showing is drawn IS
 * the い-adjective form.
 */
test("an adjective form card is kana, names the い-adjective type, and reveals the derivation", async ({
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

  // Miss it → the reveal shows the derivation: an unknown vehicle renders in
  // kana throughout (see grammarHint, lib/engine/hint.ts), so this is the
  // kana-only equation, not a kana/kanji pair — the derivation's own
  // "becomes" line already says the answer once, which is why the reveal's
  // sentence is suppressed for a derivation-hint card (showsRevealSentence,
  // lib/drill-reveal.ts) rather than stacked above it. The equation's spans
  // sit flush together with no text-node space between them (only CSS gap),
  // so the rendered text runs "becomes" and "→" together with no surrounding
  // space.
  const box = answerBox(page);
  await expect(box).toBeVisible();
  await box.fill("ちがう");
  await box.press("Enter");
  await expect(reveal(page).box).toContainText("たかいbecomesたかければ");
  await expect(reveal(page).box).toContainText("い-adjective");
  await expect(reveal(page).box).toContainText("たかい− い+ ければ→たかければ");
});

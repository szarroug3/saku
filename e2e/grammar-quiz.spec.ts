import { test, expect, STEADY_CFG, optionButtons } from "./helpers/app";
import { seedQuiz, ask, startQuizDrill } from "./helpers/quiz";

import { patternMeaningFactId } from "@/data/grammar";
import { RECIPES, isProducible } from "@/data/grammar/recipes";

/**
 * GRAMMAR QUIZ SURFACE — the drill, not the lesson walk.
 *
 * This drives `/practice → /quiz` with a single seeded grammar fact, the same
 * lever ask-forms-settings.spec.ts uses, so it is independent of the lesson flow
 * (how sittings are grouped) and of the Library. It pins what folding the
 * reference patterns into the curriculum introduced: a REFERENCE pattern — one
 * the app cannot ask you to BUILD (a particle, a dictionary-form recognition
 * pattern, an order-free wrap) — is now taught and quizzed, and its only fact is
 * MEANING, so the drill must ask it as a multiple-choice recognition card, never
 * a typed production one.
 *
 * The target is taken from the shipped recipe table (the first non-producible
 * pattern), so it follows the data rather than a hard-coded id and fails loudly
 * if the reference set ever empties.
 *
 * The producible-side drill (build the form, across every ending) is pinned by
 * the unit suite (production-coverage.test.ts); an end-to-end build/grade drill
 * is added alongside once its card locators are validated against a real run.
 */

const REFERENCE = RECIPES.find((r) => !isProducible(r));

test("the recipe table still carries a reference (non-producible) pattern", () => {
  expect(REFERENCE, "no non-producible reference pattern in the table").toBeTruthy();
});

test("a reference pattern is drilled by meaning multiple-choice, not production", async ({
  page,
}) => {
  const recipe = REFERENCE!;
  await seedQuiz(page, {
    seen: [patternMeaningFactId(recipe.id)],
    cfg: {
      ...STEADY_CFG,
      ...ask({ jpPrompts: ["text"], jpResponses: ["definition"], jpAnswers: ["mc"] }),
    },
  });
  await startQuizDrill(page);

  // The pattern itself is the prompt glyph — it is asked, not built. Match on the
  // pattern's own kana (past the leading 〜) so the assertion tracks the data.
  await expect(page.locator(".kq-glyph").first()).toContainText(
    recipe.pattern.replace(/[〜]/g, "").slice(0, 2),
  );

  // A recognition card: multiple-choice options and NO typed answer box. The
  // missing input box is the real proof it is not being drilled as production.
  await expect(optionButtons(page)).not.toHaveCount(0);
  await expect(page.locator('input[placeholder*="Enter to submit"]')).toHaveCount(0);
});

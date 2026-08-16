import { test, expect, optionButtons, STEADY_CFG } from "./helpers/app";
import { seedQuiz, ask, startQuizDrill } from "./helpers/quiz";

import { patternMeaningFactId } from "@/data/grammar";
import { RECIPES, isProducible } from "@/data/grammar/recipes";
import { PARTICLE_TAP_DRILL_IDS } from "@/lib/grammar/questions";

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
 * if the reference set ever empties. は/が/を are excluded from the pick: those
 * three now draw their own dedicated "tap the marked word" card instead of the
 * generic fixed-meaning MC fallback this suite is pinning — see
 * e2e/grammar-particle-tap-drill.spec.ts for their coverage.
 *
 * The producible-side drill (build the form, across every ending) is pinned by
 * the unit suite (production-coverage.test.ts); an end-to-end build/grade drill
 * is added alongside once its card locators are validated against a real run.
 */

const REFERENCE = RECIPES.find(
  (r) => !isProducible(r) && !PARTICLE_TAP_DRILL_IDS.has(r.id),
);

test("the recipe table still carries a reference (non-producible) pattern", () => {
  expect(REFERENCE, "no non-producible reference pattern in the table").toBeTruthy();
});

test("a reference pattern is drilled by meaning, not production", async ({
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

  // A reference pattern carries NO production fact — there is nothing to build —
  // so the only card it can draw is its MEANING question. Reaching a card at all
  // is the proof it is taught and quizzed rather than dropped from the drill. The
  // seeded pattern is the only fact in the pool, so whichever direction the card
  // takes — the pattern as the prompt (jp→en) or its meaning as the prompt
  // (en→jp) — the glyph is about this one pattern. Assert either the pattern's
  // kana or a word of its gloss, so the test does not depend on the direction the
  // drill happens to pick. (That the meaning question is a multiple-choice card
  // with distinct options is pinned by the unit suite, grammar-library.test.ts.)
  const kana = recipe.pattern.replace(/[〜]/g, "").slice(0, 2);
  const glossWords = recipe.gloss.match(/[A-Za-z]+/g) ?? [];
  const glossWord = glossWords.reduce((a, b) => (b.length > a.length ? b : a), "");
  await expect(page.locator(".kq-glyph").first()).toContainText(
    new RegExp(`${kana}|${glossWord}`),
  );
});

test("pattern definitions stay multiple choice when Type it is selected", async ({
  page,
}) => {
  const recipe = REFERENCE!;
  await seedQuiz(page, {
    seen: [patternMeaningFactId(recipe.id)],
    cfg: {
      ...STEADY_CFG,
      ...ask({ jpPrompts: ["text"], jpResponses: ["definition"], jpAnswers: ["typed"] }),
    },
  });
  await startQuizDrill(page);

  await expect(optionButtons(page).first()).toBeVisible();
  await expect(page.getByRole("textbox")).toHaveCount(0);
});

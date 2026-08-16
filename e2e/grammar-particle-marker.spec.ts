import { test, expect, STEADY_CFG } from "./helpers/app";
import { seedQuiz, ask, instruction, startQuizDrill } from "./helpers/quiz";

import { patternMeaningFactId } from "@/data/grammar";
import { recipe } from "@/data/grammar/recipes";

/**
 * PARTICLE MARKER-CHOICE — the tap-drill's sibling form (see
 * grammar-particle-tap-drill.spec.ts's header for the shared safety
 * argument).
 *
 * The tap-drill shows the particle and asks which word it marks; this asks
 * the same fact the other way: the marked WORD is highlighted (dim the rest,
 * light the target — the halo's `body` slot, same treatment the
 * kanji-in-word reading card uses), and the learner picks which particle
 * marks it from a small multiple-choice board.
 *
 * Modeled on grading.spec.ts's `missTheBoard` pattern: click a KNOWN-wrong
 * option (read off the rendered board, not guessed), then check the reveal —
 * every other MC board in the app holds a miss open (STEADY_CFG's
 * `retries: "none"`) rather than auto-advancing, so this board should behave
 * the same way.
 *
 * drill-screen.tsx rolls a 50/50 coin between this board and the tap-drill
 * for the same が meaning fact — there is no test-side seed for that coin, so
 * a run that lands on the tap-drill instead is skipped rather than failed;
 * grammar-particle-tap-drill.spec.ts covers that half of the roll.
 */
test("a が meaning fact can be drilled by picking the particle for a highlighted word", async ({
  page,
}) => {
  await seedQuiz(page, {
    seen: [patternMeaningFactId("ga")],
    cfg: {
      ...STEADY_CFG,
      ...ask({ jpPrompts: ["text"], jpResponses: ["definition"], jpAnswers: ["mc"] }),
    },
  });
  await startQuizDrill(page);

  // The marker-choice board never has tappable sentence chunks (that is the
  // tap-drill's shape) — its sentence is static text with one highlighted
  // span, and the options live in the MC grid below the halo.
  const tapChunks = page.locator('p[lang="ja"] button');
  const isMarkerChoice = (await tapChunks.count()) === 0;
  test.skip(!isMarkerChoice, "this run rolled the tap-drill sibling instead");

  await expect(instruction(page)).toHaveText("Which particle marks this word?");

  // The sentence renders inside the halo as plain (non-tappable) text.
  const sentence = page.locator('.kq-glyph p[lang="ja"]');
  await expect(sentence).toBeVisible();
  const jpText = (await sentence.textContent())?.trim() ?? "";
  expect(jpText.length).toBeGreaterThan(0);

  // The MC board holds at least 2 options, none pre-colored before a pick.
  const options = page.locator('button:has(span[lang="ja"])');
  const count = await options.count();
  expect(count).toBeGreaterThanOrEqual(2);
  for (let i = 0; i < count; i++) {
    await expect(options.nth(i)).not.toHaveClass(/border-success|border-danger/);
  }

  // が's own display pattern (〜が) is the correct option — read off the data,
  // not guessed, so this stays independent of which distractors this run
  // rolled. Click the first option that is NOT it.
  const correctLabel = recipe("ga")?.pattern;
  expect(correctLabel, "が must have a recipe with a display pattern").toBeTruthy();
  const labels = await options.allTextContents();
  const wrongAt = labels.findIndex((l) => l.trim() !== correctLabel);
  expect(wrongAt, `the board offered nothing but "${correctLabel}"`).toBeGreaterThan(-1);
  await options.nth(wrongAt).click();

  // A miss holds the reveal open (STEADY_CFG's retries: "none" + showAnswer)
  // rather than auto-advancing — exactly the discipline grading.spec.ts pins
  // for every other MC board. The correct option lights up green in place.
  const correctOption = options.filter({ hasText: correctLabel! });
  await expect(correctOption).toHaveClass(/border-success/);
  await expect(page.getByRole("button", { name: "Continue" })).toBeVisible();
});


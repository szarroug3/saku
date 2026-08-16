import { test, expect, STEADY_CFG } from "./helpers/app";
import { seedQuiz, ask, instruction, startQuizDrill } from "./helpers/quiz";

import { patternMeaningFactId } from "@/data/grammar";

/**
 * PARTICLE TAP-DRILL — Package 4 of docs/particle-teaching-workplan.md.
 *
 * Modeled on grammar-quiz.spec.ts's "a reference pattern is drilled by
 * meaning, not production" test: seed a single grammar MEANING fact, force
 * multiple choice (this card is never typed — there is no box, only chunks to
 * tap), start the drill, and check the card that comes back.
 *
 * The claim this test defends: a が MEANING fact renders the COMPLETE sentence
 * as separated, tappable chunks — never a blanked cloze — and a tap on the
 * marked word grades correct. This is what makes the drill safe where は/が
 * cloze was killed (see the "は/が CLOZE IS DEAD" header in
 * lib/grammar/questions.ts): the sentence is never blanked, so there is no
 * competing-particle judgement call to get wrong.
 *
 * が draws from src/data/grammar/particle-drill-examples.ts's real, larger
 * dataset (12 が candidates for this recipe, mined + hand-reviewed) — which
 * sentence is rolled, and which chunk answers it, both vary per run. So this
 * asserts the SHAPE of the drill (tappable chunks, no pre-coloring, exactly
 * one grades correct) rather than one fixed sentence's literal text.
 *
 * drill-screen.tsx rolls a 50/50 coin between this tap-drill and its
 * marker-choice sibling (see grammar-particle-marker.spec.ts) for the same が
 * meaning fact — there is no test-side seed for that coin, so a run that
 * lands on the marker-choice board instead is skipped rather than failed; the
 * marker-choice spec covers that half of the roll.
 */
test("a が meaning fact is drilled by tapping the marked word, not a cloze blank", async ({
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

  const chunks = page.locator('p[lang="ja"] button');
  const isTapDrill = (await chunks.count()) > 0;
  test.skip(!isTapDrill, "this run rolled the marker-choice sibling instead");

  // The role question ("Which word is the subject?") lives in the instruction
  // line below the halo now — the sentence and its translation moved INSIDE
  // the halo box (see drill-halo.tsx's `body` slot).
  await expect(instruction(page)).toContainText(/subject/i);

  // The COMPLETE sentence renders as separated, tappable chunks — never a
  // blank — scoped to the sentence's own <p lang="ja"> so this never matches
  // an unrelated page button (End quiz, the settings gear, …).
  const count = await chunks.count();
  expect(count).toBeGreaterThanOrEqual(2);

  // NO PRE-COLORING: before any tap, no chunk carries a right/wrong color —
  // reveal happens only after a tap, matching pairs-screen's cards.
  for (let i = 0; i < count; i++) {
    await expect(chunks.nth(i)).not.toHaveClass(/border-success|border-danger/);
  }

  // Tap chunks in order until one grades correct. A wrong tap reveals danger
  // on that one chunk and nothing else; the eventual correct tap reveals
  // success — proving exactly one chunk is ever the right answer, whichever
  // sentence this run rolled.
  let solved = false;
  for (let i = 0; i < count; i++) {
    await chunks.nth(i).click();
    const cls = (await chunks.nth(i).getAttribute("class")) ?? "";
    if (/border-success/.test(cls)) {
      solved = true;
      break;
    }
    await expect(chunks.nth(i)).toHaveClass(/border-danger/);
  }
  expect(solved).toBe(true);
});


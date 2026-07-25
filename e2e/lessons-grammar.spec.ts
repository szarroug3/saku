import {
  test,
  expect,
  seenKanaAndVerb,
  lessonCard,
} from "./helpers/lessons";

import {
  GRAMMAR_PER_LESSON_DEFAULT,
  nextGrammarLesson,
} from "@/lib/grammar-lesson";
import type { HistoryFile } from "@/types";

/**
 * THE GRAMMAR TRACK'S LESSON STEP TEACHES A PATTERN.
 *
 * Grammar opens after kana is done and its first patterns attach to a verb, so
 * the track stays hidden until a verb is met (nextGrammarLesson). Seeding kana
 * complete plus one verb (言う) opens the head of the order — the 〜て family, all
 * N5 — and the step teaches how the pattern is built ("How to build it") rather
 * than drilling it. The lesson is taken from the app's own scheduler so the
 * expectation moves with the shipped curriculum.
 */

// The head grammar lesson the seeded history opens, from the scheduler itself —
// a guard that the seed really does open the track before the UI walk runs.
const HISTORY = {
  sessions: [],
  facts: {},
  seen: Object.fromEntries(seenKanaAndVerb().map((f) => [f, 1])),
} as unknown as HistoryFile;
const LESSON = nextGrammarLesson(HISTORY, GRAMMAR_PER_LESSON_DEFAULT);

test("a grammar lesson step teaches how its pattern is built", async ({
  page,
  seed,
}) => {
  expect(
    LESSON,
    "kana-done + one verb should open the head of the grammar track",
  ).toBeTruthy();

  await seed({ seen: seenKanaAndVerb(), cfg: {} });
  await page.goto("/learn");

  // The grammar card is the one whose eyebrow says "grammar".
  const card = lessonCard(page, "grammar");
  await expect(card).toHaveCount(1);
  await card.getByRole("button", { name: "Start", exact: true }).click();
  await page.waitForURL("**/session");

  // The pattern's own build recipe — the section a grammar step teaches with,
  // instead of a meaning/reading. Its heading is fixed copy. The walk may open on
  // an intro card, so step forward until it appears.
  const built = page.getByText("How to build it", { exact: true });
  for (let i = 0; i < 6 && !(await built.isVisible()); i++) {
    await page.getByRole("button", { name: "Next", exact: true }).click();
  }
  await expect(built).toBeVisible();
});

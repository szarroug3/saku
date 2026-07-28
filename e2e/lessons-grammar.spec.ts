import {
  test,
  expect,
  seenKanaAndVerb,
  lessonCard,
} from "./helpers/lessons";

import { nextGrammarLesson } from "@/lib/grammar-lesson";
import type { HistoryFile } from "@/types";

/**
 * THE GRAMMAR TRACK'S FIRST SITTING TEACHES THE て-FORM.
 *
 * Grammar opens after kana is done and its first patterns attach to a verb, so
 * the track stays hidden until a verb is met (nextGrammarLesson). Seeding kana
 * complete plus one verb (言う) opens the head of the order. The head is a FORM
 * lesson — the authored て/で-form walk (te-sequence), taught alone — so the
 * session teaches how the て-form is built across its pages (eyebrow "Building
 * the て/で-form", the reworked multi-page teaching that replaced the single
 * "How to build it" recipe card). The lesson is taken from the app's own
 * scheduler so the expectation moves with the shipped curriculum.
 */

// The head grammar sitting the seeded history opens, from the scheduler itself —
// a guard that the seed really does open the track before the UI walk runs.
const HISTORY = {
  sessions: [],
  facts: {},
  seen: Object.fromEntries(seenKanaAndVerb().map((f) => [f, 1])),
} as unknown as HistoryFile;
const LESSON = nextGrammarLesson(HISTORY);

test("the grammar track's first sitting teaches building the て-form", async ({
  page,
  seed,
}) => {
  expect(
    LESSON,
    "kana-done + one verb should open the head of the grammar track",
  ).toBeTruthy();
  // The head is the て-form form-lesson, taught solo (one card in the sitting).
  expect(LESSON!.cards.map((c) => c.id)).toEqual(["te-sequence"]);

  await seed({ seen: seenKanaAndVerb(), cfg: {} });
  await page.goto("/learn");

  const card = lessonCard(page, "grammar");
  await expect(card).toHaveCount(1);
  await card.getByRole("button", { name: "Start", exact: true }).click();
  await page.waitForURL("**/session");

  // The walk opens on the track's own intro card ("Grammar is how words fit
  // together"); step forward until the て-form build pages appear. Their eyebrow
  // is fixed copy, the heading a grammar teach step now teaches WITH.
  const building = page.getByText("Building the て/で-form", { exact: true }).first();
  for (let i = 0; i < 8 && !(await building.isVisible()); i++) {
    await page.getByRole("button", { name: "Next", exact: true }).click();
  }
  await expect(building).toBeVisible();
});

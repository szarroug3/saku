import { test, expect, type Page } from "./helpers/app";

import { nextCurriculumLesson } from "@/lib/curriculum-lesson";
import { KANA_GROUPS } from "@/lib/lesson";
import { compositePositionLabel } from "@/lib/lesson-position";
import { LESSON_RANGE_DEFAULT } from "@/lib/lesson-sizing";
import type { FactId, HistoryFile } from "@/types";

/**
 * ONE CHARACTER, THREE ROLES, ON THE SCREEN.
 *
 * The redesign's central claim is that a lesson step teaches every role its
 * character plays, stacked and each under its own heading: 人 is a shape other
 * kanji are built on, a character in its own right, AND a word you can say. The
 * bug it was built to fix is described at the top of src/lib/lesson-roles.ts:
 * the view branched on `LessonItem.kind`, an item carries exactly one kind, so a
 * folded character rendered ONE role's material and the other two were "promised
 * and never delivered".
 *
 * `lesson-roles.test.ts` proves the FUNCTIONS answer correctly. Nothing proved
 * the page draws what they answer — there is no renderer in the unit harness,
 * and the module's own comment records that the previous attempt at pinning the
 * view's behaviour was a regex over its source. A regression that dropped a role
 * block, or that put the standalone-readings gate back the way it was, is
 * silent: the suite stays green, the counter still says "2 of 5", and the
 * learner is simply never told 人 is a word.
 *
 * This is also the only e2e that reaches the curriculum spine at all. Every
 * other lesson spec seeds an empty history, which is day one and therefore kana,
 * and the kana card is a different component on a different scheduler.
 */

/** Every kana fact, so the kana track is finished and the home feed offers the
 * curriculum card instead (home-feed.tsx: `lesson ? null : nextCurriculumLesson`). */
const KANA_FACTS: FactId[] = KANA_GROUPS.flatMap((g) => g.facts);

/** The same history the seed writes, so the expectations below are computed from
 * exactly the state the app will be in. */
const KANA_DONE = {
  sessions: [],
  facts: {},
  seen: Object.fromEntries(KANA_FACTS.map((f) => [f, 1])),
} as unknown as HistoryFile;

/**
 * The first curriculum lesson, taken from the app's own scheduler rather than
 * written out. Today that is 人 · 一 · 亅 · 丁 at "Radical 1 of 90 · Kanji 1–3 of
 * 2,136 · Word 1–2 of 6,213", and it will move as the tables do; what must not
 * move is that the card names the lesson the scheduler chose.
 */
const LESSON = nextCurriculumLesson(KANA_DONE, LESSON_RANGE_DEFAULT)!;

/** The step's headword, which is a Library link labelled by its glyph. */
function headword(page: Page, glyph: string) {
  return page.getByRole("link", { name: `Open ${glyph} in the Library` });
}

/** A role heading on a lesson step (src/components/lesson/role-block.tsx). */
function roleHeading(page: Page, title: string) {
  return page.getByRole("heading", { level: 3, name: title, exact: true });
}

test("a folded character's lesson step teaches all three of its roles", async ({
  page,
  seed,
}) => {
  expect(
    LESSON,
    "the curriculum scheduler offered no lesson for a kana-complete history",
  ).toBeTruthy();
  const folded = LESSON.cards.find((c) => c.glyph === "人");
  expect(
    folded,
    "the first curriculum lesson no longer contains 人, the three-role character this spec is about",
  ).toBeTruthy();

  await seed({ seen: KANA_FACTS, cfg: {} });
  await page.goto("/learn");

  // THE CARD. One card for the whole spine, headed by a composite position that
  // counts each kind of thing the lesson teaches rather than a lesson ordinal.
  const card = page
    .locator("div.kq-material")
    .filter({ hasText: "Up next · Radical" });
  await expect(card).toHaveCount(1);
  await expect(card).toContainText(
    `Up next · ${compositePositionLabel(LESSON.position)}`,
  );
  // The tile says what the character IS, in the ladder's order. This is the
  // label the step's headings have to agree with.
  await expect(card).toContainText("Radical · Kanji · Word");

  await card.getByRole("button", { name: "Start", exact: true }).click();
  await page.waitForURL("**/session");

  // Step to 人. The walk may open on a phase intro card (src/lib/spine-intros.ts),
  // so this advances until the character arrives rather than assuming a position,
  // and fails loudly if it never does.
  const person = headword(page, "人");
  for (let i = 0; i < 6 && !(await person.isVisible()); i++) {
    await page.getByRole("button", { name: "Next", exact: true }).click();
  }
  await expect(person, "the walk never reached the step teaching 人").toBeVisible();

  // ALL THREE BLOCKS, IN THE LADDER'S ORDER. The headings are the only thing on
  // the page naming what the reader is looking at — the badge that used to say
  // it is gone — so their absence is the regression, not a cosmetic one.
  await expect(roleHeading(page, "Radical")).toBeVisible();
  await expect(roleHeading(page, "Kanji")).toBeVisible();
  await expect(roleHeading(page, "Word")).toBeVisible();
  await expect(page.getByRole("heading", { level: 3 })).toHaveText([
    "Radical",
    "Kanji",
    "Word",
  ]);

  // Each block's line is its substance, and the radical block is nothing BUT its
  // line, so a block rendered empty would still pass a heading-only check.
  await expect(page.locator("body")).toContainText(
    "Other kanji are built on this shape.",
  );
  await expect(page.locator("body")).toContainText("This is also a full word on its own.");
  // The kanji block's own material: the character's meaning, whichever track the
  // step arrived on.
  await expect(page.locator("body")).toContainText("person");

  // THE WORD BLOCK SHOWS ONLY THE READING THAT STANDS ALONE. 人 has three
  // readings on file and only ひと is a word: じん is the -ian suffix and にん
  // counts people, and printing either here tells a beginner they can say 人 that
  // way (see standaloneSenses in src/lib/lesson-roles.ts). This is the assertion
  // that catches the gate being loosened back to "every sense".
  await expect(page.locator("body")).toContainText("ひと");
  await expect(page.locator("body")).not.toContainText("じん");
  await expect(page.locator("body")).not.toContainText("にん");
});

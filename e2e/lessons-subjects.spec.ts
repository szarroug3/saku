import {
  test,
  expect,
  seenToReachCurriculum,
  lessonCard,
  stepToHeadword,
  type Page,
} from "./helpers/lessons";

/**
 * EACH KIND OF THING THE CURRICULUM SPINE TEACHES, TAUGHT CORRECTLY ON ITS STEP.
 *
 * The unified spine (curriculum-order.ts) hands a lesson radicals, kanji and
 * words together, and `lesson-item-view.tsx` renders a different set of sections
 * for each. The unit tests prove the section-choosing functions; these prove the
 * WALK draws what they choose. Every target is reached by seeding the exact
 * `seen` set that puts its lesson at the frontier (see helpers/lessons.ts), then
 * stepping the teach walk to the character.
 *
 * The named examples are the plan's, verified against the shipped tables at spec
 * load: 亅 is the first radical-only shape (group 0), 可 the first kanji whose
 * pieces are both teachable characters (group 1), 電話 the compound word broken
 * into 電でん + 話わ, and 人 the first word carrying a verified pitch.
 */

/** Open the curriculum card that holds `glyph`'s tile and start its teach walk. */
async function startCurriculumLesson(page: Page, glyph: string) {
  await page.goto("/learn");
  // The curriculum card is the only "Up next" card carrying this glyph as a tile;
  // the post-kana sibling tracks (grammar, counters, …) never show it.
  const card = lessonCard(page, glyph);
  await expect(card).toHaveCount(1);
  await card.getByRole("button", { name: "Start", exact: true }).click();
  await page.waitForURL("**/session");
}

test("a radical-only step teaches the shape's own meaning", async ({
  page,
  seed,
}) => {
  // 亅 is a building block with no word and no kanji role of its own; its whole
  // lesson is the "Radical" heading, its one line, and the shape's meaning.
  await seed({ seen: seenToReachCurriculum("亅"), cfg: {} });
  await startCurriculumLesson(page, "亅");
  await stepToHeadword(page, "亅");

  // The redesigned page (CharacterEntryView) renders the radical block, which for a
  // radical-only shape drops the "As a radical" label (a single-role glyph) and
  // states the shape's own meaning as "It means <meaning>." (radicals.ts).
  await expect(page.locator("body")).toContainText("It means");
  await expect(page.locator("body")).toContainText("hook");
  // Other kanji built on the shape are listed under "Used as a part in".
  await expect(page.locator("body")).toContainText("Used as a part in");
});

test("a kanji step shows what it is Built from, each piece a link", async ({
  page,
  seed,
}) => {
  // 可 = 丁 (street) + 口 (mouth): both pieces are characters the learner already
  // has, so `teachableParts` returns them and KanjiPartsRow draws the row. A
  // kanji whose components include a raw primitive (何's 亻) yields null and shows
  // nothing here — that decomposition lives on the Library page (see the kanji
  // page spec), which is why the lesson's example is 可 and not 何.
  await seed({ seen: seenToReachCurriculum("可"), cfg: {} });
  await startCurriculumLesson(page, "可");
  await stepToHeadword(page, "可");

  // The redesigned kanji block lists the pieces the character is built from under
  // a "Sub-components" sub-heading (CharacterEntryView -> builtFrom), each a link
  // into its own page -- replacing the old KanjiPartsRow / "How it's built" card.
  await expect(page.getByText("Sub-components", { exact: true })).toBeVisible();
  // 可's etymology: semantic 口 + phonetic 丂. 口 is a jōyō kanji with a page.
  await expect(
    page.getByRole("link", { name: /口/ }).first(),
  ).toBeVisible();
});

// REMOVED: "a compound word step shows the reading pieces it is Built from" (電話).
// The content-model curriculum spine (the "vocab" UnitTrack) teaches only SINGLE
// glyphs — `orderedUnits` builds units via `buildGlyphItem`, which returns nothing
// for a multi-character string, so a compound word like 電話 is never a lesson step
// (its readings are attributed to its constituent kanji instead). The "written
// with" breakdown for 電話 now lives on its Library word page, which is covered by
// lessons-word-pieces.spec.ts. No compound-word lesson step exists to walk to, so
// this case is deleted.

// REMOVED: "a word step draws the pitch-accent overline for a word with verified
// pitch". The redesigned word teaching page (CharacterEntryView) shows the reading
// as plain text and no longer renders the pitch-accent overline / pitch-mark
// aria-label (pitch-mark.tsx is no longer used by the entry views). With no
// replacement notation on the page, there is nothing to assert; the behaviour was
// removed by the meaning-model redesign, so the test case is deleted.

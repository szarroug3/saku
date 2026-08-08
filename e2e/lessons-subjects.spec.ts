import {
  test,
  expect,
  KANA_FACTS,
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

  await expect(
    page.getByRole("heading", { level: 3, name: "Radical", exact: true }),
  ).toBeVisible();
  await expect(page.locator("body")).toContainText(
    "Other kanji are built on this shape.",
  );
  // The shape's own meaning, under "What it means" (radicalMeaningOf → radicals.ts).
  await expect(page.locator("body")).toContainText("What it means");
  await expect(page.locator("body")).toContainText("hook");
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

  await expect(
    page.getByRole("heading", { level: 3, name: "Kanji", exact: true }),
  ).toBeVisible();
  // The lesson now shows "How it\u2019s built" (from KanjiBuiltFrom with etymology
  // pieces) rather than the old KanjiPartsRow "Built from".
  await expect(page.locator("body")).toContainText("How it\u2019s built");
  // 可's etymology: semantic 口 + phonetic 丂. 口 is a jōyō kanji with a page.
  await expect(
    page.getByRole("link", { name: /口/ }).first(),
  ).toBeVisible();
});

test("a compound word step shows the reading pieces it is Built from", async ({
  page,
  seed,
}) => {
  // 電話 (でんわ) is 電 saying でん and 話 saying わ. The word block's "Built from"
  // is the compound breakdown (WordBuiltFrom), gated to words of two-plus kanji;
  // a single-kanji word has nothing to take apart and shows none of it on the
  // lesson.
  await seed({ seen: seenToReachCurriculum("電話"), cfg: {} });
  await startCurriculumLesson(page, "電話");
  await stepToHeadword(page, "電話");

  // A two-character WORD plays no single-glyph character role, so its sections
  // come back UNLABELLED — there is no "Word" role heading here (that is for a
  // folded character like 人). The Built from card itself is the material.
  // The lesson walk uses a flat surface (no kq-material), so find by label text.
  const builtFromLbl = page.getByText("Built from", { exact: true });
  await expect(builtFromLbl).toBeVisible();
  // The two kanji pieces with the sound each makes IN THIS WORD.
  const builtFrom = builtFromLbl.locator("..");
  await expect(builtFrom.getByText("電", { exact: true })).toBeVisible();
  await expect(builtFrom.getByText("でん", { exact: true })).toBeVisible();
  await expect(builtFrom.getByText("話", { exact: true })).toBeVisible();
  await expect(builtFrom.getByText("わ", { exact: true })).toBeVisible();
});

test("a word step draws the pitch-accent overline for a word with verified pitch", async ({
  page,
  seed,
}) => {
  // 人 (ひと) has a verified pitch (atamadaka, downstep 1), so its word-sense
  // panel replaces the plain reading with the overline notation — drawn with
  // borders and spelled out in an aria-label for anyone not seeing the line
  // (pitch-mark.tsx). The concept card that teaches the mark is DRAFT copy, so
  // this asserts the notation itself, which is the fixed fact.
  await seed({ seen: KANA_FACTS, cfg: {} });
  await startCurriculumLesson(page, "人");
  await stepToHeadword(page, "人");

  // The overline's aria-label names the reading and its accent in plain language.
  await expect(
    page.getByLabel(/ひと, pitch accent: atamadaka/),
  ).toBeVisible();
});

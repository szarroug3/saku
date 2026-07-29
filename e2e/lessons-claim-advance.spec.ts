import {
  test,
  expect,
  STEADY_CFG,
  direction,
  style,
  textFilter,
  startPractice,
  answerBox,
  requeuedPill,
} from "./helpers/app";

/**
 * CLAIMING A LESSON ADVANCES THE FRONTIER AND LEAVES THE ITEMS CLAIMED, NOT
 * SOLID, AND THAT CLAIM IS STILL FALSIFIABLE BY A MISS.
 *
 * The memory note this guards: "I already know these" SKIPS the lesson, it does
 * not assert mastery. So the claim has to do two separable things and nothing
 * more. It must move the curriculum on (the next group becomes the current
 * lesson), and it must write the items as `claimed`, the grey "you skipped the
 * lesson, untested" state that the knowledge base reads as claimed and NEVER as
 * solid (src/lib/library/standing.ts: `claimed` is a distinct standing from
 * `solid`, and effectiveState only reaches `solid` with a real showing behind
 * it).
 *
 * lesson.spec.ts already proves the advance (group 1 → group 2), and
 * lessons-claim.spec.ts proves the AGGREGATE stat reads "claimed" not "solid".
 * This file adds the PER-ENTRY standing (the Library row's StandingChip, the one
 * adjective an entry is allowed to wear) reached through the real lesson claim,
 * and then the falsifiability half: a claim is not a score, so missing a claimed
 * item in a drill must flip it off "claimed" immediately. That flip is proven
 * from a SEEDED claim in quiz-live-standing.spec.ts; here the claim is written by
 * the actual lesson button, which is a different code path onto the same state.
 */

/** The day-one lesson is hiragana group 1, the five vowels, from an empty
 * history. Its claim button names the count. */
const CLAIM_GROUP_1 = "I already know these 5";

/** The Library row for a single kana, narrowed by searching the glyph itself.
 * Mirrors quiz-live-standing.spec.ts's surface. */
const LIBRARY_A = "/library?kind=kana&q=あ";

test("claiming the first group advances to the next lesson and marks the items claimed, not solid", async ({
  page,
  seed,
}) => {
  // Empty history: the curriculum offers hiragana group 1, and nothing is solid
  // because nothing has been drilled.
  await seed({ seen: [], cfg: {} });

  await page.goto("/learn");
  await expect(page.locator("body")).toContainText("group 1 of");

  await page.getByRole("button", { name: CLAIM_GROUP_1, exact: true }).click();

  // The frontier moved: the NEXT group is now the current lesson. This is the
  // "advance" half, asserted by the position label the /learn card prints.
  await expect(page.locator("body")).toContainText("group 2 of");

  // The claimed items carry the CLAIMED standing per entry, never SOLID. Only a
  // real showing can make a fact solid, and the claim was a skip, so the row for
  // あ must read "claimed" and the word "solid" must be absent from that surface.
  await page.goto(LIBRARY_A);
  await expect(page.getByText("claimed", { exact: true })).toBeVisible();
  await expect(page.getByText("solid", { exact: true })).toHaveCount(0);
});

/** A drill config that narrows the pool to the single claimed kana あ, so the one
 * card drawn is the one whose standing we then re-read. STEADY_CFG is endless and
 * retries-none, so a wrong answer resolves at once instead of asking again. */
const DRILL_A_ONLY = {
  ...STEADY_CFG,
  ...direction("jp2en"),
  ...style("jp2en", "typed"),
  ...textFilter("あ"),
};

test("a claimed item stops reading claimed the moment it is missed", async ({
  page,
  seed,
}) => {
  // The drill config is pinned from the start; the lesson flow ignores it, and it
  // is what makes the later practice draw exactly あ.
  await seed({ seen: [], cfg: DRILL_A_ONLY });

  // Reach the claim through the real lesson button, not a seeded claims record.
  await page.goto("/learn");
  await page.getByRole("button", { name: CLAIM_GROUP_1, exact: true }).click();
  await expect(page.locator("body")).toContainText("group 2 of");

  // The claim landed as "claimed" in the Library.
  await page.goto(LIBRARY_A);
  await expect(page.getByText("claimed", { exact: true })).toBeVisible();

  // Drill the one claimed card the filter allows, and miss it. retries-none means
  // the miss resolves and is counted as re-queued.
  await startPractice(page);
  const box = answerBox(page);
  await expect(box).toBeVisible();
  await box.fill("definitely-wrong");
  await box.press("Enter");
  await expect(requeuedPill(page)).toHaveText("1 re-queued");

  // Back in the Library the same entry no longer reads "claimed": a fact with a
  // showing behind it cannot be claimed, and the live fold applies the miss at
  // read time (src/lib/library/live-standing.ts). The claim was falsifiable, as a
  // skip must be and a score would not be.
  await page.goto(LIBRARY_A);
  await expect(page.getByText("あ", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("claimed", { exact: true })).toHaveCount(0);
});

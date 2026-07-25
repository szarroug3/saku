import {
  test,
  expect,
  seenToReachKana,
  lessonCard,
  stepToHeadword,
} from "./helpers/lessons";

/**
 * THE KANA WHOSE SOUND IS DECIDED BY WHAT FOLLOWS IT.
 *
 * ん does not have one fixed sound: it becomes m before b/p/m (しんぶん →
 * shimbun), ng before k/g, n elsewhere. The lesson step teaches this in
 * `KanaContextView` — a small "How it's said in context" table — and
 * `kana-context.test.ts` proves the data, but nothing proved the WALK renders
 * it. A regression that dropped the block, or stopped mounting it on the step
 * where the kana is first met, is silent: the learner infers "shinbun" from the
 * grid and is marked down for it later.
 *
 * っ carries the same kind of context table in the data, but it is NOT taught as
 * a kana group of its own (it is absent from KANA_GROUPS), so there is no lesson
 * step to walk to and it is not covered here — its view is exercised on the
 * Library entry, which is Phase 3.
 *
 * Reached by seeding every kana group ahead of ん as met, so the kana track's
 * next lesson is the group that teaches it, then walking to the step itself.
 */

test("the ん lesson step teaches its context pronunciation, m before b/p/m", async ({
  page,
  seed,
}) => {
  await seed({ seen: seenToReachKana("ん"), cfg: {} });
  await page.goto("/learn");

  // Only the kana track's card says "hiragana"; the post-kana tracks are still
  // locked here, but this keeps the target unambiguous regardless.
  const card = lessonCard(page, "hiragana");
  await expect(card).toHaveCount(1);
  await card.getByRole("button", { name: "Start", exact: true }).click();
  await page.waitForURL("**/session");

  await stepToHeadword(page, "ん");

  // The block header, then the summary line, then the row that is the whole point
  // of this spec: the m-allophony before a labial, spelled exactly as the learner
  // reads it. The component upper-cases the first letter of the rule and prints
  // ": said " between the environment and the sound (kana-context-view.tsx).
  await expect(page.locator("body")).toContainText("How it's said in context");
  await expect(page.locator("body")).toContainText(
    "ん has no fixed sound of its own.",
  );
  await expect(page.locator("body")).toContainText("Before b, p, or m: said m");
  // And the other environments, so a block rendered with only its first row would
  // still fail.
  await expect(page.locator("body")).toContainText("Before k or g: said");
  await expect(page.locator("body")).toContainText(
    "before a vowel, y, or w: said",
  );
});

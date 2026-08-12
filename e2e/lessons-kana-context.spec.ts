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

  // Only the kana track's card is up here (post-kana tracks stay locked until kana
  // is done); its eyebrow reads "Up next · Hiragana …" for a hiragana group.
  const card = lessonCard(page, "Hiragana");
  await expect(card).toHaveCount(1);
  await card.getByRole("button", { name: "Start", exact: true }).click();
  await page.waitForURL("**/session");

  await stepToHeadword(page, "ん");

  // The redesigned kana page shows the following-sound rules as a "Heads up."
  // aside (KanaEntryView): the summary line, then one row per environment reading
  // "<environment> → said <sound> <example>" (kana-context.ts). The m-allophony
  // before a labial is the whole point of this spec.
  await expect(page.locator("body")).toContainText("Heads up.");
  await expect(page.locator("body")).toContainText(
    "ん has no fixed sound of its own.",
  );
  await expect(page.locator("body")).toContainText("Before b, p, or m");
  await expect(page.locator("body")).toContainText("しんぶん (shimbun)");
  // And the other environments, so a block rendered with only its first row would
  // still fail.
  await expect(page.locator("body")).toContainText("Before k or g");
  await expect(page.locator("body")).toContainText(
    "before a vowel, y, or w",
  );
});

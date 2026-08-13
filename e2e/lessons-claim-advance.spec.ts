import { test, expect } from "./helpers/app";

/**
 * CLAIMING A LESSON ADVANCES THE FRONTIER.
 *
 * The memory note this guards: "I already know these" SKIPS the lesson, it does
 * not assert mastery — so the claim must move the curriculum on (the next group
 * becomes the current lesson).
 *
 * This file USED to also assert the PER-ENTRY standing the claim writes, read off
 * the Library row's StandingChip ("claimed", never "solid"), plus the
 * falsifiability half (a live miss flips a claimed item off "claimed" at once).
 * The Library no longer paints per-entry standing at all — standing display was
 * removed everywhere but the Practice filters — so that surface is gone. The
 * behaviour it observed is still covered without a UI to read it from:
 *   - the claim→miss fold is unit-tested in src/lib/library/live-standing.test.ts
 *     ("a CLAIMED fact missed live stops reading 'claimed' at once");
 *   - the AGGREGATE "claimed" not "solid" is asserted in lessons-claim.spec.ts.
 * What is left here is the one thing those don't: that the real lesson claim
 * button advances the frontier.
 */

/** The day-one lesson is hiragana group 1, the five vowels, from an empty
 * history. Its claim button names the count. */
const CLAIM_GROUP_1 = "I already know these 5";

test("claiming the first group advances to the next lesson", async ({
  page,
  seed,
}) => {
  // Empty history: the curriculum offers hiragana group 1.
  await seed({ seen: [], cfg: {} });

  await page.goto("/learn");
  await expect(page.locator("body")).toContainText("Hiragana 1–5 of");

  await page.getByRole("button", { name: CLAIM_GROUP_1, exact: true }).click();

  // The frontier moved: the NEXT group is now the current lesson.
  await expect(page.locator("body")).toContainText("Hiragana 6–10 of");
});

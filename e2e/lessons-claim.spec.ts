import { test, expect } from "./helpers/lessons";

/**
 * CLAIMING A GROUP ADVANCES THE CURRICULUM AND LEAVES THE ITEMS UNTESTED.
 *
 * "I already know these" is a statement that the learner does not need the
 * LESSON — it must NOT be read as mastery. The claim advances the frontier (the
 * next group comes up) AND records the items as `claimed`, which on the
 * knowledge base reads as "claimed" (grey), never "solid". A later quiz miss is
 * still free to flip that off; a claim is not a score. This guards the split the
 * memory note calls out: claim = skip the lesson, start untested.
 *
 * The existing lesson.spec.ts "claiming the first group advances the curriculum"
 * asserts only the advance; this adds the untested standing, on the day-one kana
 * group where the whole flow is reachable from an empty history.
 */

test("claiming the first group advances AND leaves the items claimed, not solid", async ({
  page,
  seed,
}) => {
  await seed({ seen: [], cfg: {} });

  await page.goto("/learn");
  await expect(page.locator("body")).toContainText("group 1 of");

  await page
    .getByRole("button", { name: "I already know these 5", exact: true })
    .click();

  // The frontier advanced: the next group is now offered.
  await expect(page.locator("body")).toContainText("group 2 of");

  // The knowledge base reflects the claim as CLAIMED, not SOLID. Nothing has been
  // drilled, so there is no solid bucket at all — the "What you know" card shows a
  // claimed count and never the word "solid".
  await page.goto("/stats");
  const knowledge = page
    .locator("div.kq-material")
    .filter({ hasText: "What you know" });
  await expect(knowledge).toContainText("claimed");
  await expect(knowledge).not.toContainText("solid");
});

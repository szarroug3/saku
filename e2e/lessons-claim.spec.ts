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
 * This is the one browser owner for the claim path: it checks both the frontier
 * advance and the resulting aggregate standing. Pure claim/history semantics
 * remain covered by the unit suite.
 */

test("claiming the first group advances AND leaves the items claimed, not solid", async ({
  page,
  seed,
}) => {
  await seed({ seen: [], cfg: {} });

  await page.goto("/learn");
  await expect(page.locator("body")).toContainText("Hiragana 1–5 of");

  await page
    .getByRole("button", { name: "I already know these 5", exact: true })
    .click();

  // The frontier advanced: the next group is now offered.
  await expect(page.locator("body")).toContainText("Hiragana 6–10 of");

  // The knowledge base reflects the claim as CLAIMED, not SOLID. Nothing has been
  // drilled, so there is no solid bucket at all — the "What you know" card shows a
  // claimed count and never the word "solid".
  await page.goto("/stats");
  // The de-boxed "What you know" card is now a bare <section> (its Lbl heading +
  // the bucket counts), no kq-material wrapper. Anchor to that section.
  const knowledge = page
    .locator("section")
    .filter({ hasText: "What you know" });
  await expect(knowledge).toContainText("claimed");
  await expect(knowledge).not.toContainText("solid");
});

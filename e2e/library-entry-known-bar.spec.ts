import { test, expect } from "./helpers/app";

/**
 * SAK-130: THE LIBRARY ENTRY PAGE'S "MARK AS KNOWN" FOOTER BAR.
 *
 * The entry-page variant of SliceBar (src/components/library/slice-bar.tsx)
 * used to offer only "Mark as not known" and "Quiz me" — an unclaimed entry
 * with fewer than 2 quizzable forms genuinely rendered nothing at all, which
 * was the "I see nothing" bug report. Fixed to also offer "✓ I know this",
 * mutually exclusive with "Mark as not known" depending on the entry's own
 * claim state — this pins that dependent-on-state behavior directly, which
 * had no coverage anywhere (the shelf bar's own claim/unclaim has e2e
 * coverage elsewhere in this suite; the entry page's did not).
 */

test("an unclaimed entry offers Mark as known, and claiming it flips the bar to Mark as not known", async ({
  page,
  seed,
}) => {
  await seed({ seen: [], cfg: {} });
  await page.goto("/library/hiragana/ka");

  const knowBtn = page.getByRole("button", { name: "✓ I know this", exact: true });
  await expect(knowBtn).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Mark as not known", exact: true }),
  ).toHaveCount(0);

  await knowBtn.click();

  // Dependent on state: claiming flips which single action is offered, not
  // both at once.
  const unclaimBtn = page.getByRole("button", { name: "Mark as not known", exact: true });
  await expect(unclaimBtn).toBeVisible();
  await expect(knowBtn).toHaveCount(0);

  await unclaimBtn.click();
  await expect(knowBtn).toBeVisible();
  await expect(unclaimBtn).toHaveCount(0);
});

test("a word entry with 2+ quizzable forms offers both Mark as known and Quiz me", async ({
  page,
  seed,
}) => {
  await seed({ seen: [], cfg: {} });
  await page.goto("/library/word/人");

  await expect(
    page.getByRole("button", { name: "✓ I know these", exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: /^Quiz me \d+$/ })).toBeVisible();
});

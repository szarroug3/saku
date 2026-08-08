import { test, expect } from "./helpers/app";

import { COUNTER_CURRICULUM, counterMeaningFactId } from "@/data/counters";
import { KANA_GROUPS } from "@/lib/lesson";

/**
 * REGRESSION: counters prep sessions must stay on the counters card and keep a
 * counters-oriented HUD label.
 *
 * The failure this pins:
 * 1) Start a counters lesson whose teach set is prereq-only kanji/radicals.
 * 2) Session HUD sublabel showed "Kanji" (derived from first prereq fact).
 * 3) Back on /learn, Continue session appeared on the spine card instead of the
 *    counters card (run classified by prereq fact subjects).
 *
 * This test drives that exact path and asserts both surfaces.
 */

const KANA_FACTS = KANA_GROUPS.flatMap((g) => g.facts);

function counterSeenThrough(indexInclusive: number): string[] {
  return COUNTER_CURRICULUM.slice(0, indexInclusive).map((f) => counterMeaningFactId(f));
}

test("counters prep lesson shows Numbers label and resumes from counters card", async ({
  page,
  seed,
}) => {
  // Kana complete opens post-kana tracks; mark the first 〜つ forms seen so the
  // next counters lesson is a prep-style one that currently starts on kanji/radical
  // prereqs (the reported regression path).
  await seed({
    seen: [...KANA_FACTS, ...counterSeenThrough(10)],
    cfg: {},
  });

  await page.goto("/learn");

  const countersCard = page
    .locator("div.kq-material")
    .filter({ hasText: /^Up next · counters/i })
    .first();
  const spineCard = page
    .locator("div.kq-material")
    .filter({ hasText: /^Up next · kanji/i })
    .first();

  await expect(countersCard).toBeVisible();
  await countersCard.getByRole("button", { name: "Start", exact: true }).click();
  await page.waitForURL("**/session");

  // Teaching HUD must stay counters-oriented, not "Kanji" from prereq-first facts.
  await expect(page.getByText(/^Numbers$/, { exact: true })).toBeVisible();

  await page.goto("/learn");

  await expect(
    countersCard.getByRole("button", { name: "Continue session", exact: true }),
  ).toBeVisible();
  await expect(
    spineCard.getByRole("button", { name: "Continue session", exact: true }),
  ).toHaveCount(0);
});

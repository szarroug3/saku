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

  // On the content-model feed each track's card is a NextLessonPreview glass panel
  // ([data-learn-card]) headed "Up next · <noun> …": the counters card counts in
  // "Counter", the curriculum spine (radicals/kanji/words) counts in the neutral
  // "Item". Those nouns tell the two apart.
  const countersCard = page
    .locator("[data-learn-card]")
    .filter({ hasText: "Up next" })
    .filter({ hasText: "Counter" })
    .first();
  const spineCard = page
    .locator("[data-learn-card]")
    .filter({ hasText: "Up next" })
    .filter({ hasText: "Item" })
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

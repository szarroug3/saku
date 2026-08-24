import { test, expect, teachPosition } from "./helpers/app";

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

  // On the content-model feed each track's card is a NextLessonPreview
  // ([data-learn-card]) with a position line and a track-title heading (the
  // de-box redesign dropped the old "Up next" eyebrow). The counters card's
  // position line counts in "Counter"; the curriculum spine is the "Vocabulary"
  // track. Those tell the two apart.
  const countersCard = page
    .locator("[data-learn-card]")
    .filter({ hasText: "Counter" })
    .first();
  const spineCard = page
    .locator("[data-learn-card]")
    .filter({ hasText: "Vocabulary" })
    .first();

  await expect(countersCard).toBeVisible();
  await countersCard.getByRole("button", { name: "Start", exact: true }).click();
  await page.waitForURL("**/session");

  // Teaching HUD must stay counters-oriented, not "Kanji" from prereq-first facts.
  // SAK-7 unified this track's learner-facing name to "Counting" everywhere
  // (session HUD included); "Numbers" is now an internal sub-type label only.
  // SAK-145 round 1 folded the sublabel into the same plain-text span as the
  // "N of M" position ("Counting · 1 of 8"), so this checks the merged text
  // rather than a standalone "Counting" node.
  await expect(teachPosition(page)).toHaveText(/^Counting · \d+ of \d+$/);

  await page.goto("/learn");

  await expect(
    countersCard.getByRole("button", { name: "Continue session", exact: true }),
  ).toBeVisible();
  await expect(
    spineCard.getByRole("button", { name: "Continue session", exact: true }),
  ).toHaveCount(0);
});

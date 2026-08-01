import { test, expect } from "./helpers/app";

import { GRAMMAR_CONCEPTS, grammarConceptEntry } from "@/data/grammar-concepts";
import { patternEntry } from "@/data/grammar";
import { entryHref } from "@/lib/library/href";

/**
 * GRAMMAR-CONCEPT LIBRARY PAGES — the reference pages behind the grammar patterns
 * (the て-form, う-verbs vs る-verbs, い/な-adjectives, keigo registers).
 *
 * These pin what a concept page IS: a resolvable prose reference with no sound
 * (it has an English title, not a Japanese word to speak), reached from its own
 * shelf and linked from the patterns it explains. The targets come from the
 * shipped GRAMMAR_CONCEPTS list, so a new concept is covered with no edit here.
 */

for (const concept of GRAMMAR_CONCEPTS) {
  test(`the ${concept.id} concept page renders, with no speaker`, async ({ page }) => {
    const res = await page.goto(entryHref(grammarConceptEntry(concept.id)));
    expect(res!.status(), `${concept.id} did not serve`).toBeLessThan(400);
    await expect(page.locator("body")).not.toContainText("This page could not be found");
    // The concept's name is on the page (as its heading).
    await expect(page.locator("body")).toContainText(concept.name);
    // A concept is prose, not a sound: no "Hear …" speaker anywhere on the page.
    await expect(page.getByRole("button", { name: /^Hear / })).toHaveCount(0);
  });
}

/**
 * The loop above proves each concept page SERVES and shows its title. This proves
 * the three concepts authored fresh (no te-form lesson prose to reuse) actually
 * TEACH on the page — a stub with only a heading would pass the loop while saying
 * nothing. Pin the substantive tokens that ARE each concept: the group names, the
 * canonical example words, the honorific/humble verbs. The te-form's depth is its
 * lesson's, covered elsewhere; these three stood up on their own.
 */
const CONCEPT_CONTENT: Array<{ id: string; mustShow: string[] }> = [
  { id: "verb-classes", mustShow: ["godan", "ichidan", "する", "くる"] },
  { id: "adjective-types", mustShow: ["たかい", "しずか", "きれい"] },
  { id: "keigo-registers", mustShow: ["めしあがる", "いただく"] },
];

for (const { id, mustShow } of CONCEPT_CONTENT) {
  test(`the ${id} concept page teaches, not just titles`, async ({ page }) => {
    await page.goto(entryHref(grammarConceptEntry(id)));
    for (const token of mustShow) {
      await expect(page.locator("body")).toContainText(token);
    }
  });
}

test("a て-verb pattern lists its concept links under ONE 'Read about it'", async ({
  page,
}) => {
  // 〜てから is a て-form pattern (so it links the て-form concept) that also
  // conjugates a verb (so it links verb-classes). The two links must sit under a
  // single 'Read about it' label, not one label each.
  await page.goto(entryHref(patternEntry("te-kara")));
  await expect(page.getByText("Read about it", { exact: true })).toHaveCount(1);
  await expect(page.getByRole("link", { name: /う-verbs and る-verbs/ })).toBeVisible();
  // The form it builds on (the て-form's own entry) is linked from the Links box,
  // above the verb-classes reference. There is no standalone te-form CONCEPT page.
  await expect(page.getByRole("link", { name: /The .*-form/ })).toBeVisible();
});

test("the て-form's Library page teaches what it is for, not only how to build it", async ({
  page,
}) => {
  // The form entry (te-sequence) is a single page carrying the SAME teaching the
  // lesson shows: what the form is for (a casual request), then how to build it.
  await page.goto(entryHref(patternEntry("te-sequence")));
  await expect(page.getByText(/casual request/i)).toBeVisible();
  // The build table is still there (the う→って row).
  await expect(page.getByText("かって").first()).toBeVisible();
});

test("the grammar-concept shelf lists the concepts and shows no speaker", async ({
  page,
}) => {
  await page.goto("/library?kind=grammar-concept");
  // The concepts are actually on the shelf (guards against a vacuous pass)…
  await expect(page.getByText(GRAMMAR_CONCEPTS[0].name).first()).toBeVisible();
  // …and none of their rows carry a speaker button.
  await expect(page.getByRole("button", { name: /^Hear / })).toHaveCount(0);
});

test("a verb-pair wrap pattern shows a worked pair example", async ({ page }) => {
  // 〜たり〜たり builds no example through apply() (it needs two words); the auto
  // page instead shows a worked pair on eat/drink/talk. The finished pair must be
  // on the entry.
  await page.goto(entryHref(patternEntry("tari-tari")));
  await expect(page.locator("body")).toContainText("たべたりのんだりする");
});

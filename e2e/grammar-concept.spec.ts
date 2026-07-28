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

test("a て-verb pattern lists its concept links under ONE 'Read about it'", async ({
  page,
}) => {
  // 〜てから is a て-form pattern (so it links the て-form concept) that also
  // conjugates a verb (so it links verb-classes). The two links must sit under a
  // single 'Read about it' label, not one label each.
  await page.goto(entryHref(patternEntry("te-kara")));
  await expect(page.getByText("Read about it", { exact: true })).toHaveCount(1);
  await expect(page.getByRole("link", { name: /The て-form/ })).toBeVisible();
  await expect(page.getByRole("link", { name: /う-verbs and る-verbs/ })).toBeVisible();
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

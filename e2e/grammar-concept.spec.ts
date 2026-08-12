import { test, expect } from "./helpers/app";

import { GRAMMAR_CONCEPTS, grammarConceptEntry } from "@/data/grammar-concepts";
import { FORM_RECIPE_IDS, patternEntry } from "@/data/grammar";
import { formLibraryPages } from "@/data/grammar/lessons";
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
  { id: "adjective-types", mustShow: ["たかい", "しずか", "きれい", "嫌い"] },
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

test("the adjective concept is one concise class guide, without a repeated title", async ({
  page,
}) => {
  await page.goto(entryHref(grammarConceptEntry("adjective-types")));
  await expect(page.getByText("い-adjectives and な-adjectives.", { exact: true })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "い-adjectives change their own ending." })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "な-adjectives take な, and lean on です." })).toHaveCount(0);
  await expect(page.locator("body")).not.toContainText("The app tags each word's kind");
  await expect(page.getByRole("table")).toHaveCount(0);
});

test("the adjective noun form has its own Library entry", async ({ page }) => {
  await page.goto(entryHref(patternEntry("prenominal-form")));
  // The redesigned pattern page (GrammarEntryView) has no h1; its gloss
  // ("describe a noun") sits in the glyph header beside the pattern "〜な".
  await expect(page.locator("body")).toContainText("describe a noun");
  await expect(page.getByText("The 〜な form", { exact: true })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Describe a noun." })).toHaveCount(0);
  await expect(page.locator("body")).not.toContainText("lets an adjective describe a noun");
  await expect(page.getByRole("heading", { name: "Adjectives", exact: true })).toHaveCount(0);
  await expect(page.getByText("Adjective Types", { exact: true })).toHaveCount(0);
  const beforeANoun = page.getByRole("heading", { name: "Before a noun", exact: true });
  await expect(beforeANoun).toHaveCount(1);
  const adjectiveTable = beforeANoun.locator("xpath=ancestor::section[1]").getByRole("table");
  await expect(adjectiveTable.getByRole("columnheader", { name: "Meaning" })).toHaveCount(0);
  await expect(
    page.getByRole("heading", { name: "Grammar is how words fit together." }),
  ).toHaveCount(0);
});

test("the Grammar shelf starts with the 〜な form", async ({ page }) => {
  await page.goto("/library?kind=grammar");
  const naForm = page.getByRole("button", { name: "〜な form", exact: true });
  const teForm = page.getByRole("button", { name: "て/で-form", exact: true });
  await expect(naForm).toBeVisible();
  await expect(teForm).toBeVisible();
  expect(
    await naForm.evaluate((node, other) =>
      Boolean(node.compareDocumentPosition(other as Node) & Node.DOCUMENT_POSITION_FOLLOWING),
    await teForm.elementHandle()),
  ).toBe(true);
  await expect(page.getByText(/N[1-5] pattern/)).toHaveCount(0);
});

test("a て-verb pattern builds off the て-form, with no concept-links box", async ({
  page,
}) => {
  // 〜てから is a て-form pattern that conjugates a verb. The redesigned pattern page
  // (GrammarEntryView) dropped the old "Read about it" concept-links box; the build
  // shows one derive step off the て-form under a "Verbs" section instead.
  await page.goto(entryHref(patternEntry("te-kara")));
  await expect(page.getByText("Read about it", { exact: true })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Verbs", exact: true })).toBeVisible();
  await expect(
    page.getByText(/Put a verb into its て-form, then add から/),
  ).toBeVisible();
  // The build's own step names the て-form in its formula slot.
  await expect(
    page.locator(".border-dashed").filter({ hasText: "て-form" }).first(),
  ).toBeVisible();
  // The redesigned "How it's formed" section replaces the old "How to build it".
  await expect(page.getByText("How to build it", { exact: true })).toHaveCount(0);
});

test("a mixed verb and adjective pattern separates its build sections", async ({ page }) => {
  await page.goto(entryHref(patternEntry("node")));

  for (const heading of ["Verbs", "い-adjectives", "な-adjectives"]) {
    const sectionHeading = page.getByRole("heading", { name: heading, exact: true });
    await expect(sectionHeading).toBeVisible();
    await expect(sectionHeading.locator("..").getByRole("table")).toHaveCount(1);
    await expect(sectionHeading.locator("..").getByRole("row")).toHaveCount(2);
  }

  const verbTable = page
    .getByRole("heading", { name: "Verbs", exact: true })
    .locator("..")
    .getByRole("table");
  expect(await verbTable.evaluate((node) => node.closest(".kq-material") === null)).toBe(true);
  await expect(page.getByText("How to build it", { exact: true })).toHaveCount(0);
  await expect(page.locator(".border-dashed").filter({ hasText: "verb" })).toBeVisible();
  await expect(page.locator(".border-dashed").filter({ hasText: "い-adjective" })).toBeVisible();
  await expect(page.locator(".border-dashed").filter({ hasText: "な-adjective" })).toBeVisible();
  // (The old cross-link to the 〜な form's page — "Describe a noun →" — was dropped
  // with the concept-links box; the な-adjective build step stands on its own here.)
  await expect(page.getByText("The just as it is", { exact: false })).toHaveCount(0);
});

test("the て-form's Library page teaches what it is for, not only how to build it", async ({
  page,
}) => {
  // The form entry (te-sequence) is a single page carrying the SAME teaching the
  // lesson shows: what the form is for (a casual request), then how to build it.
  await page.goto(entryHref(patternEntry("te-sequence")));
  await expect(page.getByText(/casual request/i)).toBeVisible();
  await expect(page.getByText("Asks casually, or links ideas.", { exact: true })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "One form, several meanings." })).toBeVisible();
  await expect(page.getByRole("heading", { name: "As a verb", exact: true })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "As an adjective", exact: true })).toHaveCount(0);
  await expect(page.getByText(/a verb in the て\/で-form is a casual request/)).toBeVisible();
  await expect(page.getByText(/works with both verbs and adjectives/)).toBeVisible();
  await expect(page.getByText(/The final predicate does/)).toBeVisible();
  const verbs = page.getByRole("heading", { name: "Verbs", exact: true });
  const adjectives = page.getByRole("heading", { name: "Adjectives", exact: true });
  await expect(verbs).toHaveClass(/text-accent/);
  await expect(adjectives).toHaveClass(/text-accent/);
  await expect(page.getByText("Building the て/で-form", { exact: true })).toHaveCount(0);
  // The build table is still there (the う→って row).
  await expect(page.getByText("かって").first()).toBeVisible();
  // Its production tables expose every kind of separately scored skill: the
  // regular verb groups, each irregular verb, and all three adjective rows.
  for (const heading of ["Godan (う-verbs)", "Ichidan (る-verbs)", "Irregular verbs", "Adjectives", "Irregular adjectives"]) {
    await expect(page.getByText(heading, { exact: true }).first()).toBeVisible();
  }
  for (const form of ["たかくて", "よくて", "しずかで"]) {
    await expect(page.locator("body")).toContainText(form);
  }
  const irregularAdjectives = page
    .getByText("Irregular adjectives", { exact: true })
    .first()
    .locator("..");
  await expect(irregularAdjectives.getByRole("columnheader", { name: "Note" })).toHaveCount(0);
  await expect(page.getByText("いい uses よ as its stem.", { exact: true })).toHaveCount(0);
});

test("every form page puts instructions between its section heading and table", async ({
  page,
}) => {
  for (const recipeId of FORM_RECIPE_IDS) {
    await page.goto(entryHref(patternEntry(recipeId)));
    for (const section of formLibraryPages(recipeId).flatMap((intro) => intro.buildSections ?? [])) {
      // Shared written patterns now put every sense on the same page. Potential
      // and passive both have a "Verbs" section, so find the section by its
      // own instruction instead of blindly taking the page's first heading.
      const renderedSection = page
        .getByText(section.body[0].text, { exact: false })
        .first()
        .locator("xpath=ancestor::section[1]");
      const heading = renderedSection.getByRole("heading", {
        name: section.title,
        exact: true,
      });
      if (section.hideTitle) {
        await expect(
          page.getByRole("heading", { name: section.title, exact: true }),
          `${recipeId}/${section.title} hidden heading`,
        ).toHaveCount(0);
      } else {
        await expect(heading, `${recipeId}/${section.title} heading`).toHaveClass(/text-accent/);
      }
      await expect(
        renderedSection,
        `${recipeId}/${section.title} instruction`,
      ).toContainText(section.body[0].text);
      await expect(renderedSection.getByRole("table")).toHaveCount(
        section.rules?.length ? 1 : section.tables?.length ?? 0,
      );
    }
  }
});

test("one shared-pattern page teaches every definition", async ({ page }) => {
  await page.goto("/library/grammar/passive");
  await expect(page).toHaveURL(/\/library\/grammar\/passive$/);
  await expect(page.locator("body")).toContainText("can do X");
  await expect(page.locator("body")).toContainText("is X-ed (by someone)");
  await expect(page.getByRole("heading", { name: "Verbs", exact: true })).toHaveCount(2);
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

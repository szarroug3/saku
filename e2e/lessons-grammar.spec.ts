import {
  test,
  expect,
  KANA_FACTS,
  lessonCard,
  isVisibleSoon,
} from "./helpers/lessons";

import { patternMeaningFactId } from "@/data/grammar";
import { nextGrammarLesson } from "@/lib/grammar-lesson";
import type { HistoryFile } from "@/types";

/**
 * THE GRAMMAR TRACK OPENS WITH ADJECTIVES, THEN TEACHES THE て-FORM.
 *
 * Grammar opens as soon as kana is done. Its first form lesson introduces what
 * grammar/forms are, the two adjective classes, and な before a noun. The
 * authored て/で-form is the second solo form lesson.
 */

// The head grammar sitting the seeded history opens, from the scheduler itself —
// a guard that the seed really does open the track before the UI walk runs.
const HISTORY = {
  sessions: [],
  facts: {},
  claims: Object.fromEntries(KANA_FACTS.map((f) => [f, 1])),
} as unknown as HistoryFile;
const LESSON = nextGrammarLesson(HISTORY);

test("the grammar track's first sitting introduces adjective forms", async ({
  page,
  seed,
}) => {
  expect(
    LESSON,
    "kana completion alone should open the head of the grammar track",
  ).toBeTruthy();
  expect(LESSON!.cards.map((c) => c.id)).toEqual(["prenominal-form"]);

  await seed({ claims: KANA_FACTS, cfg: {} });
  await page.goto("/learn");

  // SAK-28: a track with no met fact yet opens with a one-time "card 0" intro
  // teaser (TrackIntroCard, heading = the track's proper name) in place of its
  // ordinary lesson card. Grammar has no met fact from this seed, so its slot
  // shows that teaser first; "Start track" only dismisses it for this page
  // load (it does not start a lesson), after which the real lesson card
  // renders in the same slot.
  const introCard = page
    .locator("[data-learn-card][data-track-intro]")
    .filter({ hasText: "Grammar" });
  await expect(introCard).toHaveCount(1);
  await introCard.getByRole("button", { name: "Start track", exact: true }).click();

  // "grammar" alone matches the sentence card too (its why says "…words and
  // grammar into sentences…"); the grammar card's tiles carry the "grammar rule"
  // type label, which is unique to it.
  const card = lessonCard(page, "grammar rule");
  await expect(card).toHaveCount(1);
  await card.getByRole("button", { name: "Start", exact: true }).click();
  await page.waitForURL("**/session");

  await expect(
    page.getByRole("heading", { name: "Grammar is how words fit together." }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Next", exact: true }).click();
  // Okurigana now renders as ONE term page (its two teaching cards collapsed into
  // the "Okurigana" term entry, per lesson-steps.ts) between the grammar intro and
  // Adjective Types. Both cards' prose is on that single page.
  await expect(page.locator("body")).toContainText(
    "This kana tail is called okurigana",
  );
  await expect(page.locator("body")).toContainText(
    "Sometimes the tail moves. Sometimes it stays.",
  );
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await expect(page.getByText("Adjective Types", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "い-adjectives and な-adjectives." }),
  ).toBeVisible();
  await expect(page.locator("body")).toContainText("きれい");
  await expect(page.locator("body")).toContainText(
    "When a word is written with kanji followed by a separate い",
  );
  await expect(page.locator("body")).toContainText("嫌い");
  await expect(page.getByRole("table")).toHaveCount(0);
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await expect(page.getByText("The 〜な form", { exact: true }).first()).toBeVisible();
  await expect(page.getByRole("heading", { name: "Describe a noun." })).toBeVisible();
  await expect(page.locator("body")).toContainText("lets an adjective describe a noun");
  const beforeANoun = page.getByRole("heading", { name: "Before a noun", exact: true });
  await expect(beforeANoun).toBeVisible();
  const adjectiveTable = beforeANoun.locator("xpath=ancestor::section[1]").getByRole("table");
  await expect(adjectiveTable.getByRole("columnheader", { name: "Type" })).toBeVisible();
  const iAdjective = adjectiveTable.getByRole("row").filter({ hasText: "い-adjective" });
  await expect(iAdjective).toContainText("たかい (expensive) + みせ (shop) → たかいみせ");
  const naAdjective = adjectiveTable.getByRole("row").filter({ hasText: "な-adjective" });
  const accentedNas = naAdjective.getByText("な", { exact: true });
  await expect(accentedNas).toHaveCount(2);
  expect(
    await accentedNas.evaluateAll((nodes) =>
      nodes.every((node) => node.classList.contains("text-accent")),
    ),
  ).toBe(true);
  await expect(naAdjective).toContainText("しずか (quiet) + な + みせ (shop) → しずかなみせ");
  await expect(adjectiveTable.getByRole("columnheader", { name: "Meaning" })).toHaveCount(0);
  await expect(page.locator("body")).not.toContainText("the app tags it for you");
});

test("the second grammar sitting teaches building the て-form", async ({ page, seed }) => {
  await seed({
    claims: [...KANA_FACTS, patternMeaningFactId("prenominal-form")],
    cfg: {},
  });
  await page.goto("/learn");

  // "grammar" alone matches the sentence card too (its why says "…words and
  // grammar into sentences…"); the grammar card's tiles carry the "grammar rule"
  // type label, which is unique to it.
  const card = lessonCard(page, "grammar rule");
  await card.getByRole("button", { name: "Start", exact: true }).click();
  await page.waitForURL("**/session");

  // "Verb Types" is page 2 of the te-form sitting (page 1 is the "what a form is"
  // intro), so step forward until it appears rather than expecting it first.
  const verbTypes = page.getByText("Verb Types", { exact: true });
  for (let i = 0; i < 8 && !(await isVisibleSoon(verbTypes)); i++) {
    await page.getByRole("button", { name: "Next", exact: true }).click();
  }
  await expect(verbTypes).toBeVisible();

  // Step forward until the て-form build pages appear.
  const building = page.getByRole("heading", { name: "Verbs", exact: true });
  for (let i = 0; i < 8 && !(await isVisibleSoon(building)); i++) {
    await page.getByRole("button", { name: "Next", exact: true }).click();
  }
  await expect(building).toBeVisible();

  // The adjective build table names the grammatical TYPE, not a dictionary
  // ending — な-adjectives do not have one reliable spelling ending to inspect.
  const adjectiveBuild = page.getByRole("heading", {
    name: "Adjectives",
    exact: true,
  });
  for (let i = 0; i < 5 && !(await isVisibleSoon(adjectiveBuild)); i++) {
    await page.getByRole("button", { name: "Next", exact: true }).click();
  }
  await expect(adjectiveBuild).toBeVisible();
  await expect(page.getByRole("columnheader", { name: "Type" })).toBeVisible();
  await expect(page.getByRole("cell", { name: "い-adjective" })).toBeVisible();
  await expect(page.getByRole("cell", { name: "な-adjective" })).toBeVisible();
});

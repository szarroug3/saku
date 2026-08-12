import { test, expect, KANA_FACTS, lessonCard } from "./helpers/lessons";

import { nextGrammarLesson } from "@/lib/grammar-lesson";
import { patternMeaningFactId } from "@/data/grammar";
import type { HistoryFile } from "@/types";

/**
 * A GRAMMAR SITTING BUNDLES UP TO THREE PATTERNS.
 *
 * A new FORM lesson is taught alone, but a run of pattern lessons — adding an
 * ending to a form you already know — comes up to three at a time (Sam's sizing
 * rule). Claiming kana and the first two SOLO form sittings leaves the
 * next sitting the first pattern BUNDLE: 〜ている / 〜てください /
 * 〜てもいい, all three at once (〜ている is a normal bundled pattern now). The seed is
 * taken from the scheduler, so it moves with the curriculum.
 */

const BUNDLE_SEED = [
  ...KANA_FACTS,
  patternMeaningFactId("prenominal-form"),
  patternMeaningFactId("te-sequence"),
];

// Claimed so the two met form lessons are skipped by the scheduler.
const HISTORY = {
  sessions: [],
  facts: {},
  claims: Object.fromEntries(BUNDLE_SEED.map((f) => [f, 1])),
} as unknown as HistoryFile;
const LESSON = nextGrammarLesson(HISTORY);

test("a pattern-only sitting hands out three patterns, and the session walks them all", async ({
  page,
  seed,
}) => {
  expect(LESSON, "the pattern bundle should open").toBeTruthy();
  // Three patterns in ONE sitting, in teaching order.
  expect(LESSON!.cards.map((c) => c.id)).toEqual([
    "te-iru",
    "te-request",
    "te-permission",
  ]);

  await seed({ claims: BUNDLE_SEED, cfg: {} });
  await page.goto("/learn");
  // The grammar card's tiles carry the "grammar rule" type label, unique to it
  // (a bare "grammar" also matches the sentence card's why line).
  const card = lessonCard(page, "grammar rule");
  await expect(card).toHaveCount(1);
  await card.getByRole("button", { name: "Start", exact: true }).click();
  await page.waitForURL("**/session");

  // The session emits every bundled pattern's pages, so the THIRD pattern
  // (〜てもいい) is reachable by stepping forward — the proof a sitting teaches
  // more than the first pattern.
  const third = page.getByText("〜てもいい", { exact: false }).first();
  for (let i = 0; i < 20 && !(await third.isVisible()); i++) {
    await page.getByRole("button", { name: "Next", exact: true }).click();
  }
  await expect(third).toBeVisible();
});

import { test, expect, KANA_FACTS } from "./helpers/lessons";
import { CURRICULUM_WORDS } from "@/lib/word-lesson";
import { wordMeaningFactId } from "@/data/vocab";
import { patternMeaningFactId } from "@/data/grammar";

function firstWordFacts(count: number): string[] {
  return CURRICULUM_WORDS.slice(0, count).map((word) => wordMeaningFactId(word.keb));
}

// The tile's glyph reads "Simple", not "Simple sentences": SAK-11 round 2
// (497f5b11) moved a sentence tier's tile to the same plain glyph+type-label
// shape every other track's tile uses, stripping the redundant trailing
// "sentences" (sentenceTierShortLabel in sentence-track.ts) since the type
// slot beside it already says "sentence structure". A card's title is always
// the track name "Sentences" (TRACK_TITLE.sentence), not the tier name, so
// "Simple sentences" never appears anywhere in the card as one substring —
// these specs predate that change and never got updated to match.
const SIMPLE_TIER_TEXT = "Simple";

test("Building sentences waits for a small usable vocabulary", async ({ page, seed }) => {
  await seed({ seen: [...KANA_FACTS, ...firstWordFacts(33)] });
  await page.goto("/learn");

  await expect(
    page.locator("[data-learn-card]").filter({ hasText: SIMPLE_TIER_TEXT }),
  ).toHaveCount(0);
});

test("Building sentences opens after the first 34 words", async ({ page, seed }) => {
  await seed({
    seen: [...KANA_FACTS, ...firstWordFacts(34), patternMeaningFactId("wa")],
  });
  await page.goto("/learn");

  const card = page
    .locator("[data-learn-card]")
    .filter({ hasText: SIMPLE_TIER_TEXT });
  await expect(card).toBeVisible();
  await expect(card).toContainText(SIMPLE_TIER_TEXT);
  await expect(card).toContainText("Sentences");
});

test("Building sentences waits for wa/ga even with enough vocabulary", async ({
  page,
  seed,
}) => {
  await seed({ seen: [...KANA_FACTS, ...firstWordFacts(34)] });
  await page.goto("/learn");

  await expect(
    page.locator("[data-learn-card]").filter({ hasText: SIMPLE_TIER_TEXT }),
  ).toHaveCount(0);
});

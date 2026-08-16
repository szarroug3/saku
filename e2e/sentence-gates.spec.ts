import { test, expect, KANA_FACTS } from "./helpers/lessons";
import { CURRICULUM_WORDS } from "@/lib/word-lesson";
import { wordMeaningFactId } from "@/data/vocab";
import { patternMeaningFactId } from "@/data/grammar";

function firstWordFacts(count: number): string[] {
  return CURRICULUM_WORDS.slice(0, count).map((word) => wordMeaningFactId(word.keb));
}

test("Building sentences waits for a small usable vocabulary", async ({ page, seed }) => {
  await seed({ seen: [...KANA_FACTS, ...firstWordFacts(33)] });
  await page.goto("/learn");

  await expect(
    page.locator("[data-learn-card]").filter({ hasText: "Simple sentences" }),
  ).toHaveCount(0);
});

test("Building sentences opens after the first 34 words", async ({ page, seed }) => {
  await seed({
    seen: [...KANA_FACTS, ...firstWordFacts(34), patternMeaningFactId("wa")],
  });
  await page.goto("/learn");

  const card = page
    .locator("[data-learn-card]")
    .filter({ hasText: "Simple sentences" });
  await expect(card).toBeVisible();
  await expect(card).toContainText("Simple sentences");
});

test("Building sentences waits for wa/ga even with enough vocabulary", async ({
  page,
  seed,
}) => {
  await seed({ seen: [...KANA_FACTS, ...firstWordFacts(34)] });
  await page.goto("/learn");

  await expect(
    page.locator("[data-learn-card]").filter({ hasText: "Simple sentences" }),
  ).toHaveCount(0);
});

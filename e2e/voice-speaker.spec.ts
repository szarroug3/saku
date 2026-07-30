import { test, expect } from "./helpers/app";
import { grammarConceptEntry } from "@/data/grammar-concepts";
import { entryHref } from "@/lib/library/href";

/**
 * THE SPEAKER BUTTON APPEARS ONLY WHERE THERE IS A SOUND. A kana is a
 * pronunciation, so its entry page offers a "Hear" button; a grammar concept is
 * prose with an English title and nothing to say, so it offers none. This is the
 * "unpronounceable things get no sound button" rule, guarded as a contrast so a
 * regression in either direction fails.
 *
 * It does not assert audio plays (headless has no real voices); the presence and
 * absence of the control is the honest, environment-stable check.
 */
test("a listenable entry offers a Hear button; an unpronounceable one does not", async ({
  page,
  seed,
}) => {
  await seed({});

  // A kana is a sound.
  await page.goto("/library/hiragana/a");
  await expect(
    page.getByRole("button", { name: /^Hear/ }).first(),
  ).toBeVisible();

  // A grammar concept is prose, not a sound.
  await page.goto(entryHref(grammarConceptEntry("verb-classes")));
  await expect(page.getByRole("button", { name: /^Hear/ })).toHaveCount(0);
});

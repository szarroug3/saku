import { test, expect } from "./helpers/lessons";

/**
 * THE KANJI PAGE NOW LEADS WITH "BUILT FROM", ABOVE ITS READINGS.
 *
 * The lesson step's own decomposition (KanjiPartsRow / teachableParts) is
 * all-or-nothing and shows nothing for a kanji built on a raw primitive, which
 * is most of them — 何's 亻 is exactly that case. The full shape breakdown lives
 * on the Library kanji page (KanjiBuiltFrom / `builtFrom`, which splits every
 * kanji including 何 → 亻 person + 可 possible, each piece linked), and a recent
 * change moved that card ABOVE the readings table so the shape is the first thing
 * you read (src/app/library/[...entry]/page.tsx). This guards both: the pieces
 * and links, and that Built from precedes Readings.
 *
 * This is a Library surface and belongs to Phase 3 breadth; it is asserted here
 * only because it is the concrete home of the plan's "kanji: readings table AND
 * the Built from that now leads the page (何 → 亻 + 可)" — the lesson step cannot
 * show it.
 */

test("the 何 kanji page leads with a linked Built from, above the readings table", async ({
  page,
  seed,
}) => {
  await seed({ seen: [], cfg: {} });
  await page.goto("/library/kanji/何");

  // The redesigned kanji page (CharacterEntryView) lists the pieces under a
  // "Sub-components" sub-heading, each a link to its own page (\u4f55 = \u4ebb person +
  // \u53ef possible). The flat library surface has no kq-material, so find by label.
  const builtFromLbl = page.getByText("Sub-components", { exact: true });
  await expect(builtFromLbl).toBeVisible();
  const builtFrom = builtFromLbl.locator("..");
  // The etymology component is 人 (semantic "person"), not the visual radical 亻.
  await expect(builtFrom.getByRole("link", { name: /人/ })).toBeVisible();
  await expect(builtFrom.getByRole("link", { name: /可/ })).toBeVisible();

  // The readings are still on the page, below the sub-components. The reading
  // groups open with a shared "rule of thumb" lead — a stable anchor that avoids
  // the On'yomi/Kun'yomi labels (whose (i) help icon defeats an exact text match,
  // and 何 may carry only one of the two groups).
  const readingsLbl = page.getByText("read one of these ways", { exact: false });
  await expect(readingsLbl).toBeVisible();

  // Sub-components LEADS: it sits above the readings groups in the document.
  const builtFromBox = await builtFromLbl.boundingBox();
  const readingsBox = await readingsLbl.boundingBox();
  expect(builtFromBox).not.toBeNull();
  expect(readingsBox).not.toBeNull();
  expect(builtFromBox!.y).toBeLessThan(readingsBox!.y);
});

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

  // Built from: the two shapes, each a link to its own page.
  const builtFrom = page.locator("div.kq-material").filter({ hasText: "Built from" });
  await expect(builtFrom).toHaveCount(1);
  await expect(builtFrom.getByRole("link", { name: /亻/ })).toBeVisible();
  await expect(builtFrom.getByRole("link", { name: /可/ })).toBeVisible();

  // The readings table is still on the page, headed "Readings".
  const readings = page.locator("div.kq-material").filter({ hasText: "Readings" });
  await expect(readings).toHaveCount(1);
  await expect(readings.locator("th", { hasText: "Reading" }).first()).toBeVisible();

  // Built from LEADS: its card sits above the readings card in the document.
  const builtFromBox = await builtFrom.boundingBox();
  const readingsBox = await readings.boundingBox();
  expect(builtFromBox).not.toBeNull();
  expect(readingsBox).not.toBeNull();
  expect(builtFromBox!.y).toBeLessThan(readingsBox!.y);
});

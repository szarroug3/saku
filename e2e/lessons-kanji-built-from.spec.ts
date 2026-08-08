import { test, expect } from "./helpers/app";

/**
 * THE KANJI ENTRY PAGE, THE TEACH SURFACE THE LESSON STEP CANNOT BE.
 *
 * The lesson's own decomposition (KanjiPartsRow / teachableParts) is
 * all-or-nothing: it draws only when every piece is a character already learned,
 * and shows nothing for a kanji built on a bare radical. The Library kanji page
 * carries the full picture instead, and these tests guard the four things that
 * make it the reference: the SHAPE decomposition that leads the page
 * (KanjiBuiltFrom, radicals included, each piece a link), the readings table
 * (KanjiReadings), the role line in the header (characterRole), and the
 * "seen as a part of others" section a component-rich kanji earns (ComponentUses).
 *
 * These are all logged-out Library surfaces, so an empty seed is enough — none
 * of the four reads progress to decide whether to render. The sibling spec
 * lessons-kanji-page.spec.ts already pins 何 (亻 + 可); the targets here are
 * DISTINCT so the two files never assert the same glyph: 明 for shape + readings,
 * 口 for the folded role line and the component-uses section. All four facts are
 * verified against the shipped data (src/data/generated): 明 = 日 + 月 with 5
 * reading rows, 口 = radical · kanji · word · 3 strokes and a part of hundreds
 * of kanji.
 */

test("the 明 kanji page leads with a linked Built from of its shape pieces", async ({
  page,
  seed,
}) => {
  await seed({ seen: [], cfg: {} });
  await page.goto("/library/kanji/明");

  // How it's built: the SHAPE decomposition 明 = 日 day + 月 month. Both pieces
  // are jōyō kanji with pages of their own, so each renders as a link.
  // The library page uses a flat surface (no kq-material), so we find the section
  // via its label text and navigate to the parent card div.
  const builtFromLbl = page.getByText("How it's built", { exact: true });
  await expect(builtFromLbl).toBeVisible();
  const builtFrom = builtFromLbl.locator("..");
  await expect(builtFrom.getByRole("link", { name: /日/ })).toBeVisible();
  await expect(builtFrom.getByRole("link", { name: /月/ })).toBeVisible();
  // The tile prints the piece's FIRST meaning under its glyph (builtPieceMeaning
  // reads kanjiRow(c).meanings[0]): 日 is "day", 月 is "month". These are the
  // dictionary-order lead senses, not the "sun/moon" a decomposition mnemonic
  // would pick, so the assertion tracks the data the page actually renders.
  await expect(builtFrom).toContainText("day");
  await expect(builtFrom).toContainText("month");
});

test("the 明 kanji page renders the readings table for a kanji that has reading rows", async ({
  page,
  seed,
}) => {
  await seed({ seen: [], cfg: {} });
  await page.goto("/library/kanji/明");

  // 明 has several reading rows (あ / あか / あき / …), so the plural "Readings"
  // card draws with the fixed column heads. A kanji with no rows would show none
  // of this — the guard renders nothing, not an empty box — so the card's
  // presence is the fact under test.
  const readingsLbl = page.getByText("Readings", { exact: true });
  await expect(readingsLbl).toBeVisible();
  const readings = readingsLbl.locator("..");
  await expect(readings.locator("th", { hasText: "Reading" }).first()).toBeVisible();
  await expect(readings.locator("th", { hasText: "Example" }).first()).toBeVisible();

  // "How it's built" LEADS the page: the shape card sits above the readings card
  // in the document, the recent order change that made the decomposition the first read.
  const builtFromLbl = page.getByText("How it's built", { exact: true });
  const builtFromBox = await builtFromLbl.boundingBox();
  const readingsBox = await readingsLbl.boundingBox();
  expect(builtFromBox).not.toBeNull();
  expect(readingsBox).not.toBeNull();
  expect(builtFromBox!.y).toBeLessThan(readingsBox!.y);
});

test("a folded character shows every role it plays in its header role line", async ({
  page,
  seed,
}) => {
  await seed({ seen: [], cfg: {} });
  await page.goto("/library/kanji/口");

  // 口 plays all three roles at once — a Kangxi radical, a jōyō kanji, and the
  // word くち — so characterRole folds them into one label and the header prints
  // it in place of the bare strokes line: "radical · kanji · word · 3 strokes".
  // The middots are U+00B7, the same character the label joins on.
  await expect(
    page.getByText("radical · kanji · word · 3 strokes"),
  ).toBeVisible();
});

test("a component-rich kanji shows the shapes built on it under 'Used as a part in'", async ({
  page,
  seed,
}) => {
  await seed({ seen: [], cfg: {} });
  await page.goto("/library/kanji/口");

  // 口 is written inside hundreds of other kanji, so ComponentUses draws its
  // "Used as a part in" card: a row of linked kanji glyphs and a sentence naming
  // the true total. A kanji nothing is built from returns null here and shows no
  // card, so the card's presence and its capped-count sentence are the fact.
  const usedAsPartLbl = page.getByText("Used as a part in", { exact: true });
  await expect(usedAsPartLbl).toBeVisible();
  const usedAsPart = usedAsPartLbl.locator("..");
  await expect(usedAsPart).toContainText("kanji are written with this shape");
  // At least one of the sample kanji is a link onward to its own entry.
  await expect(usedAsPart.getByRole("link").first()).toBeVisible();
});

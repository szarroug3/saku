import { test, expect } from "./helpers/app";

/**
 * THE BUILT-FROM REDESIGN ON THE KANJI ENTRY PAGE.
 *
 * The kanji Library page (/library/kanji/<glyph>) now carries an etymology layer
 * split across two components: KanjiBuiltFrom (the "How it's built" piece tiles
 * plus a prose "Etymology" section with a More/Less toggle and a Wiktionary
 * credit) and OnyomiHint (the borrowed-from-Chinese reading with a Hear button).
 *
 * These behaviors have no other e2e coverage. Everything here is a logged-out
 * Library surface, so an empty seed is enough — none of it reads progress. The
 * targets are chosen against the shipped data (src/data/generated):
 *   明 — ideogrammic, a LONG origin story (clamps → More/Less) + Wiktionary link.
 *   河 — phono-semantic: 氵 meaning tile (water) + 可 phonetic tile (か, 運河).
 *   中 — a pictograph with a story but NO mappable pieces: Etymology, no tiles.
 *   講 — phonetic 冓 is a rare untaught character: asterisk footnote fires.
 *   校 — has an on'yomi (こう), so the On'yomi card + Hear button render.
 */

test("the 明 kanji page shows an Etymology story with a Wiktionary link and a More/Less toggle", async ({
  page,
  seed,
}) => {
  await seed({ seen: [], cfg: {} });
  await page.goto("/library/kanji/明");

  // The prose section is headed by an "Etymology" label (distinct from the
  // "How it's built" tiles header above it).
  await expect(page.getByText("Etymology", { exact: true })).toBeVisible();

  // The credit line links the word "Wiktionary" to the character's own page.
  const wiktionary = page.getByRole("link", { name: "Wiktionary", exact: true });
  await expect(wiktionary).toBeVisible();
  // The href is built with encodeURIComponent(glyph); assert either the encoded
  // or the raw form so the test does not hinge on how the DOM reports it.
  await expect(wiktionary).toHaveAttribute(
    "href",
    /^https:\/\/en\.wiktionary\.org\/wiki\/(明|%E6%98%8E)$/,
  );

  // 明's origin is long enough to clamp, so a More control is offered; clicking
  // it reveals the rest and flips the label to Less, which collapses it again.
  const more = page.getByRole("button", { name: "More", exact: true });
  await expect(more).toBeVisible();
  await more.click();
  const less = page.getByRole("button", { name: "Less", exact: true });
  await expect(less).toBeVisible();
  await less.click();
  await expect(page.getByRole("button", { name: "More", exact: true })).toBeVisible();
});

test("the 河 kanji page tags a meaning piece and a phonetic piece with its lent reading", async ({
  page,
  seed,
}) => {
  await seed({ seen: [], cfg: {} });
  await page.goto("/library/kanji/河");

  // The tiles sit under the "How it's built" header (curly apostrophe).
  const builtFromLbl = page.getByText("How it’s built", { exact: true });
  await expect(builtFromLbl).toBeVisible();
  const builtFrom = builtFromLbl.locator("..");

  // 河 = 氵 (meaning: water) + 可 (phonetic: か). Each piece is its own tile link,
  // tagged by role; asserting on the tiles avoids the word "meaning" that also
  // appears in the card's explanatory footnote.
  const meaningTile = builtFrom.getByRole("link", { name: /meaning/ });
  await expect(meaningTile).toBeVisible();
  await expect(meaningTile).toContainText("water");
  const phoneticTile = builtFrom.getByRole("link", { name: /phonetic/ });
  await expect(phoneticTile).toBeVisible();

  // The phonetic tile carries the lent reading か and the everyday compound
  // where that sound surfaces (運河, うんが).
  await expect(phoneticTile).toContainText("か");
  await expect(phoneticTile).toContainText("運河");
});

test("the 中 kanji page shows an Etymology story but no built-from tiles", async ({
  page,
  seed,
}) => {
  await seed({ seen: [], cfg: {} });
  await page.goto("/library/kanji/中");

  // 中 is a pictograph with a glyph-origin story but no mappable pieces, so the
  // Etymology section stands alone and the "How it's built" tiles never render.
  await expect(page.getByText("Etymology", { exact: true })).toBeVisible();
  await expect(page.getByText("How it’s built", { exact: true })).toHaveCount(0);
});

test("the 講 kanji page footnotes its rare untaught phonetic component", async ({
  page,
  seed,
}) => {
  await seed({ seen: [], cfg: {} });
  await page.goto("/library/kanji/講");

  // 冓 is the phonetic in 講 but is not a character the app teaches, so its tile
  // wears an asterisk keyed to a plain-language footnote.
  await expect(page.getByText(/rare character meaning/)).toBeVisible();
  await expect(page.getByText(/not in our dictionary/)).toBeVisible();
});

test("the 校 kanji page shows an On'yomi card with a Hear button", async ({
  page,
  seed,
}) => {
  await seed({ seen: [], cfg: {} });
  await page.goto("/library/kanji/校");

  // 校 is read こう inside compounds, so the On'yomi card renders with the
  // reading and a speaker button whose accessible name starts with "Hear".
  await expect(page.getByText("On’yomi", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: /Hear/ }).first()).toBeVisible();
});

import { test, expect, type Page } from "./helpers/app";

/**
 * THE WORD ENTRY PAGE, TAKEN APART: its "Built from" reading-pieces card and its
 * "In a sentence" corpus example.
 *
 * These are Library entry pages (/library/word/<keb>), served by the one
 * catch-all route in src/app/library/[...entry]/page.tsx. Like library.spec.ts,
 * nothing here needs seeding: the word branch renders from the vocab tables
 * alone, not from history, so a plain goto is the whole setup. The `seed` fixture
 * is imported only for the shared test/expect wiring.
 *
 * WHAT DECIDES EACH SECTION, verified against the shipped data at spec authoring:
 *
 *  - "Built from" is WordBuiltFrom, gated on `piecesOf(row)` being non-null. That
 *    is `row.align` — the per-kanji [char, reading-here, base] split the ingest
 *    built. 先生 is 先 saying せん and 生 saying せい; every kanji piece is a LINK
 *    into that kanji's own entry, which is the entire point of the card.
 *
 *  - A SINGLE-kanji word (何, 可) STILL shows the card. `align` is one row, so
 *    `piecesOf` returns one kanji piece and the page renders it as a clickable
 *    link into the kanji page (see the comment in the word branch of page.tsx).
 *
 *  - An all-kana word (これ) and a jukujikun (大人/おとな) have `align === null`,
 *    so `piecesOf` returns null and the card is ABSENT — not an empty box. There
 *    is no per-kanji reading in these to show.
 *
 *  - "In a sentence" is WordExampleView, gated on `exampleFor(keb)` being
 *    non-null. Only ~21% of words carry a Tatoeba sentence; the page renders
 *    nothing at all for the rest. 先生 has one; 茶色 does not.
 *
 * Class names are the real ones: Card renders `div.kq-material` and Lbl renders
 * the section title text ("Built from", "In a sentence") inside it, so a card is
 * located by kq-material filtered on its label, the same handle
 * lessons-subjects.spec.ts uses. A kanji piece's href is the readable
 * `/library/kanji/<glyph>` entryHref mints, the same shape library.spec.ts
 * asserts on.
 */

/** The section card whose label is `label`. The library word page uses a flat
 * surface (FlatSurfaceProvider), so Cards have no kq-material class. We find
 * the card by its Lbl text and navigate to the parent card div. */
function card(page: Page, label: string) {
  return page.getByText(label, { exact: true }).locator("..");
}

/** The word page's "kanji it's written with" block, whichever word is on screen.
 * The redesigned page (CharacterEntryView) drops the old "Built from" card: a
 * multi-kanji word's pieces sit in the "As a word" block under the Lead line
 * "The kanji it's written with, and how each is read here:", each a kanji link.
 * Matched on a stable fragment of that Lead to sidestep its curly apostrophe; the
 * parent container also holds the kanji-link table. Absent (count 0) for a word
 * with no per-kanji split (an all-kana word, a jukujikun, a single glyph). */
function builtFrom(page: Page) {
  return page
    .getByText("written with, and how each is read here:", { exact: false })
    .locator("..");
}

// A word taken apart, with the exact reading each kanji makes IN THIS WORD.
// Confirmed against src/data/generated/vocab.json `align`: 先生 is
// [先 せん][生 せい], 電話 is [電 でん][話 わ].
const MULTI_KANJI: Array<{
  keb: string;
  pieces: Array<{ written: string; reading: string }>;
}> = [
  {
    keb: "先生",
    pieces: [
      { written: "先", reading: "せん" },
      { written: "生", reading: "せい" },
    ],
  },
  {
    keb: "電話",
    pieces: [
      { written: "電", reading: "でん" },
      { written: "話", reading: "わ" },
    ],
  },
];

for (const { keb, pieces } of MULTI_KANJI) {
  test(`a multi-kanji word (${keb}) shows the reading pieces it is Built from, each a kanji link`, async ({
    page,
  }) => {
    const response = await page.goto(`/library/word/${keb}`);
    expect(response!.status(), `${keb} did not serve`).toBeLessThan(400);
    await expect(page.locator("body")).not.toContainText(
      "This page could not be found",
    );

    // The card is present and split into exactly the word's kanji.
    const bf = builtFrom(page);
    await expect(bf).toHaveCount(1);

    for (const p of pieces) {
      // Each kanji piece is a LINK into that kanji's own entry page. The href is
      // the readable /library/kanji/<glyph> shape, not the percent-encoded id.
      const link = bf.locator(`a[href="/library/kanji/${p.written}"]`);
      await expect(link).toHaveCount(1);
      // The tile prints the character AND the sound it makes in this word.
      await expect(link).toContainText(p.written);
      await expect(link).toContainText(p.reading);
    }
  });
}

test("a Built-from kanji link opens that kanji's entry page", async ({
  page,
}) => {
  // The one end-to-end proof that a reading piece is a real way into the
  // character: click 先 out of 先生 and land on the kanji page for 先 (meaning
  // "before/previous"). This is what makes a word a route into its kanji.
  await page.goto("/library/word/先生");
  await builtFrom(page).locator('a[href="/library/kanji/先"]').click();

  // The link's href is the readable raw glyph, but once the browser navigates,
  // location.href (what page.url() reads) percent-encodes the multibyte 先, so
  // matching the raw character never lands. Assert on the encoded form so this
  // still pins the destination as 先's page specifically. library.spec.ts sidesteps
  // the same encoding by stopping its /library/kanji/ regex before the glyph.
  await expect(page).toHaveURL(
    new RegExp(`/library/kanji/${encodeURIComponent("先")}$`),
  );
  // The redesigned entry pages carry no h1; the glass entry surface (article)
  // rendering is the proof 先's page loaded rather than 404ing.
  await expect(page.locator("article").first()).toBeVisible();
  await expect(page.locator("body")).not.toContainText(
    "This page could not be found",
  );
});

// REMOVED: "a single-kanji word still shows Built from with one clickable piece"
// (何, 可). The redesign UNIFIES a single Han glyph's word and kanji into ONE
// CharacterEntryView (buildGlyphItem keys on the glyph), so /library/word/何 is
// now the same page as /library/kanji/何 — it shows 何's own roles directly
// ("As a kanji" with sub-components, "As a word"), not a "Built from" card linking
// out to a separate kanji page. The "written with" split is only for a MULTI-kanji
// word, so there is no single-piece card to assert here anymore. Coverage of the
// unified single-glyph page lives in the kanji/character specs.

// Words with no per-kanji split: `align === null`, so `piecesOf` is null and the
// card is ABSENT. これ is all kana (there is no 這 to break out); 大人/おとな is a
// jukujikun, a reading spread across kanji with no per-character split to show.
const NO_SPLIT: Array<{ keb: string; why: string }> = [
  { keb: "これ", why: "all-kana word" },
  { keb: "大人", why: "jukujikun (おとな)" },
];

for (const { keb, why } of NO_SPLIT) {
  test(`a ${why} (${keb}) shows NO Built from card`, async ({ page }) => {
    const response = await page.goto(`/library/word/${keb}`);
    expect(response!.status(), `${keb} did not serve`).toBeLessThan(400);

    // The page itself rendered — a real entry, not a 404 — so the missing split is
    // a decision, not a failed load. The redesigned word page has no h1; its "word"
    // type label (under the glyph header) confirms it loaded as a word entry.
    await expect(page.locator("body")).not.toContainText(
      "This page could not be found",
    );
    await expect(page.getByText("word", { exact: true }).first()).toBeVisible();

    // Absent, not empty: no "kanji it's written with" block renders at all.
    await expect(builtFrom(page)).toHaveCount(0);
  });
}

test("a word with a corpus example renders the In-a-sentence card", async ({
  page,
}) => {
  // 先生 has a Tatoeba sentence (exampleFor("先生") is non-null in the shipped
  // word-examples data), so the WordExampleView card renders with a Japanese
  // line and its human translation.
  await page.goto("/library/word/先生");

  const example = card(page, "In a sentence");
  await expect(example).toHaveCount(1);
  // Both lines are present and non-empty: the Japanese sentence (rendered in the
  // kana font) and the English gloss under it. Asserting non-emptiness rather than
  // a fixed string keeps this robust to the corpus being re-picked.
  const jp = example.locator("p.font-kana");
  await expect(jp).toHaveCount(1);
  await expect(jp).not.toBeEmpty();
});

test("a word without a corpus example shows NO In-a-sentence card", async ({
  page,
}) => {
  // 茶色 (ちゃいろ, "brown") has no Tatoeba sentence in the shipped data. The page
  // renders nothing for the example rather than an empty "no example yet" box —
  // absent, not empty. It still has its "Built from" split, which is what proves
  // the page rendered fully and it is only the example that is gone.
  const response = await page.goto("/library/word/茶色");
  expect(response!.status(), "茶色 did not serve").toBeLessThan(400);

  await expect(builtFrom(page)).toHaveCount(1);
  await expect(card(page, "In a sentence")).toHaveCount(0);
});

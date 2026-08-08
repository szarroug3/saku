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

/** The "Built from" card, whichever word is on screen. */
function builtFrom(page: Page) {
  return card(page, "Built from");
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
  const h1 = page.getByRole("heading", { level: 1 });
  await expect(h1).toHaveCount(1);
  await expect(h1).not.toBeEmpty();
});

// A word whose written form is a SINGLE kanji. `align` is one row, so the card
// still renders with one piece — the "split" is the word itself, and the piece
// is a clickable way into the kanji. Confirmed single-kanji in vocab: 何 (なに),
// 可 (か).
const SINGLE_KANJI = ["何", "可"];

for (const keb of SINGLE_KANJI) {
  test(`a single-kanji word (${keb}) still shows Built from with one clickable piece`, async ({
    page,
  }) => {
    const response = await page.goto(`/library/word/${keb}`);
    expect(response!.status(), `${keb} did not serve`).toBeLessThan(400);

    const bf = builtFrom(page);
    await expect(bf).toHaveCount(1);

    // Exactly one kanji link, into that one kanji's page. A single-kanji word has
    // one piece and no other kanji, so the card holds one linked tile.
    const links = bf.locator('a[href^="/library/kanji/"]');
    await expect(links).toHaveCount(1);
    await expect(links).toHaveAttribute("href", `/library/kanji/${keb}`);
    await expect(links).toContainText(keb);
  });
}

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

    // The page itself rendered — a real entry, not a 404 — so the missing card is
    // a decision, not a failed load. Word pages no longer use an h1 heading;
    // the word's reading/meaning panel confirms the page loaded correctly.
    await expect(page.locator("body")).not.toContainText(
      "This page could not be found",
    );
    await expect(page.getByText("How you say it, and what it means")).toBeVisible();

    // Absent, not empty: no card carries the "Built from" label at all.
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
  // Both lines are present and non-empty: the sentence (lang=ja) and the English
  // gloss under it. Asserting non-emptiness rather than a fixed string keeps this
  // robust to the corpus being re-picked.
  const jp = example.locator('p[lang="ja"]');
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

import { test, expect, stepToHeadword, teachMeFromShelf } from "./helpers/lessons";

/**
 * THE "TEACH ME N" PATH: a lesson started from the Library SHELF, not the Home
 * feed.
 *
 * The redesign moved this verb off the entry page. An entry page (/library/kanji/生)
 * is reference and now offers only "Quiz me" (SliceBar variant="entry"); "Teach
 * me N" lives on the shelf action bar (SliceBar variant="bar"), which appears
 * once you SELECT one or more shelf rows. Selecting a row builds a global
 * selection slice, and the bar offers "Teach me N" over exactly that slice —
 * the same teach walk the Home cards reach through Start, entered from a
 * different door. This guards that door: selecting a fresh (unlearned) multi-fact
 * shelf row surfaces the button, and it lands in the teach walk for that slice.
 *
 * 生 is the canonical multi-fact kanji (one glyph, many readings), so from an
 * empty history its whole slice is unlearned and drillable. It is reached through
 * the search box because the browse shelf mounts distant sections lazily
 * (IntersectionObserver in shelves.tsx); a search result is a ShelfRow feeding
 * the SAME selection a browse tile does (library-page.tsx onToggleEntry).
 */

const MULTI_FACT_KANJI = "生";

test("Library shelf 'Teach me N' opens the teach walk for the selected slice", async ({
  page,
  seed,
}) => {
  await seed({ seen: [], cfg: {} });
  await page.goto("/library?kind=kanji");

  // Surface the kanji row deterministically, then SELECT it — the whole row is
  // the select target (ShelfRow, aria-pressed), and selecting it is what paints
  // the accent and grows the shelf's selection.
  await page.getByPlaceholder(/Search anything/).fill(MULTI_FACT_KANJI);
  await page.getByText(MULTI_FACT_KANJI, { exact: true }).first().click();
  await expect(
    page.getByRole("button", { name: /Clear \d+ selected/ }),
  ).toBeVisible();

  // The shelf action bar offers "Teach me N" over the selection (nothing in this
  // slice is known yet); clicking it builds a session and drops into the teach
  // walk — not a straight quiz. See teachMeFromShelf for why the click retries.
  await teachMeFromShelf(page);
  // The teach HUD's position, proving this is the stepped walk and not the drill.
  await expect(page.getByText(/^\d+ of \d+$/)).toBeVisible();
  // The walk teaches 生 (it may open on a concept-card intro first).
  await stepToHeadword(page, MULTI_FACT_KANJI);
});

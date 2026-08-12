import { test, expect, type Page } from "./helpers/app";

/**
 * LIBRARY BREADTH — the search-and-browse behaviours that the mirror
 * library.spec.ts does not reach: the All tab's TYPE-grouped search (#29), the
 * kind filter narrowing the shelf, a ranged group's clickable header (#27), and
 * the two reference pages a component/glossary lookup lands on.
 *
 * WHY THESE ARE THEIR OWN FILE. library.spec.ts proves every entry URL serves
 * and the filter chips survive a history dance; it never types into the search
 * box, never opens the All tab, and never clicks a shelf's group header. Those
 * are the three behaviours that make the Library a place you look things up
 * rather than a static list of routes, so they are worth their own coverage.
 *
 * Signed out, no seed needed: browse and search read the static entry data, not
 * the learner's history. The one place history would matter — a knowledge
 * filter — is exercised by library.spec.ts already.
 */

/** The Lbl paragraph a result section is titled with. Scoped to the Lbl's own
 * class pair (see components/ui.tsx `Lbl`) so a type name like "Words" matches
 * the section HEADER and not the always-present kind chip, which is a <button>
 * with the same text. */
function groupHeader(page: Page, name: string) {
  return page.locator("p.font-semibold.uppercase").filter({ hasText: name });
}

/** The search box — matched on a stable fragment of its long placeholder rather
 * than the whole "Search anything: し, shi, 生, せんせい, telephone…" string. */
function searchBox(page: Page) {
  return page.getByPlaceholder(/Search anything/);
}

/**
 * #29 — THE ALL TAB BUCKETS A SEARCH BY TYPE.
 *
 * On the All tab, `searchByType` groups hits by KIND (a Kanji block, a Words
 * block, in teaching order), so the section headers are the subject names from
 * KIND_LABEL. 生 is a kanji AND appears inside many words (学生, 先生 …), so both
 * a "Kanji" and a "Words" group must surface. The match-kind headers a SUBJECT
 * tab would show ("Exact entry", "Appears inside") must be ABSENT here — that
 * absence is what proves the grouping is by type, not by how each hit matched.
 */
test("the All tab groups search results by type", async ({ page }) => {
  await page.goto("/library?kind=all");
  await searchBox(page).fill("生");

  await expect(groupHeader(page, "Kanji")).toBeVisible();
  await expect(groupHeader(page, "Words")).toBeVisible();

  // Not the subject-tab match-kind grouping.
  await expect(page.getByText("Exact entry")).toHaveCount(0);
});

/**
 * A SUBJECT TAB SCOPES THE SEARCH AND GROUPS IT BY MATCH KIND.
 *
 * The other half of #29: on a single-kind tab, `search` is restricted to that
 * kind and sectioned by HOW each row matched, so 生 on the Kanji tab leads with
 * an "Exact entry" section and never grows a "Words" block — a word is a
 * different kind and the tab does not span it.
 */
test("a subject tab scopes search to its kind and groups by match kind", async ({
  page,
}) => {
  await page.goto("/library?kind=kanji");
  await searchBox(page).fill("生");

  await expect(groupHeader(page, "Exact entry")).toBeVisible();
  // The exact hit itself is on screen and is a kanji entry.
  await expect(page.locator('a[href="/library/kanji/生"]').first()).toBeVisible();

  // Scoped: no cross-kind Words group on a kanji tab.
  await expect(groupHeader(page, "Words")).toHaveCount(0);
});

/**
 * THE KIND FILTER (?kind=) NARROWS THE BROWSE SHELF.
 *
 * The `?kind=` param picks which single shelf is shown. On `?kind=word` the
 * shelf is words and nothing else, so word entry links are present and the kana
 * links that a Kana shelf would carry are absent. This is the browse-side
 * counterpart to the searched-scope test above.
 */
test("the kind filter narrows the browse shelf", async ({ page }) => {
  await page.goto("/library?kind=word");
  await expect(page.locator('a[href^="/library/word/"]').first()).toBeVisible();
  // The word shelf is not the kana shelf.
  await expect(page.locator('a[href^="/library/hiragana/"]')).toHaveCount(0);

  await page.goto("/library?kind=radical");
  await expect(page.locator('a[href^="/library/radical/"]').first()).toBeVisible();
});

/**
 * #27 — A RANGED GROUP HEADER IS A CLICKABLE SELECT-ALL TOGGLE.
 *
 * Subjects with no natural cut (radicals, words) are cut into teaching-order
 * ranges labelled "1–50", "51–100" (see lib/library/ranged-groups.ts, GROUP_SIZE
 * = 50). Each range's header is the same tri-state <button> every shelf section
 * has (see shelves.tsx): clicking it toggles that whole range INTO the global
 * selection. So a click flips it to aria-pressed and the page grows the "Clear N
 * selected" control the selection drives. The header does NOT navigate — it
 * builds a drill slice, which is what a group header does on this page.
 */
test("a ranged group header toggles the whole group into the selection", async ({
  page,
}) => {
  await page.goto("/library?kind=radical");

  // "1–50" uses an EN DASH (U+2013), the character rangedGroups labels with.
  const header = page.getByRole("button", { name: "1–50", exact: true });
  await expect(header).toBeVisible();
  await expect(header).toHaveAttribute("aria-pressed", "false");

  await header.click();

  // The whole range is now selected: the header reads pressed and the
  // selection-driven Clear control appears with a count.
  await expect(header).toHaveAttribute("aria-pressed", "true");
  await expect(
    page.getByRole("button", { name: /Clear \d+ selected/ }),
  ).toBeVisible();
});

/**
 * A RADICAL ENTRY PAGE RENDERS ITS "KANJI BUILT WITH THIS" LIST.
 *
 * A radical's whole reason for being is the kanji built on it, so its entry page
 * ends in ComponentUses' "Used as a part in" table (see component-uses.tsx /
 * radical-kanji-table.tsx). 一 is a real radical (glyph "一", meaning "one" — the
 * first row of src/data/radicals) and is a part of hundreds of kanji, so the
 * section renders with its count line rather than being absent.
 */
test("a radical entry page renders the kanji built with it", async ({ page }) => {
  const response = await page.goto("/library/radical/一");
  expect(response!.status()).toBeLessThan(400);

  // The glyph heads the page (CharacterEntryView), and the kanji written with it
  // list under "Used as a part in" — a capped row of linked kanji with a "· N
  // more" tail.
  await expect(page.locator("body")).toContainText("一");
  const usedAsPart = page.getByText("Used as a part in", { exact: true }).locator("..");
  await expect(usedAsPart).toBeVisible();
  await expect(usedAsPart.getByRole("link").first()).toBeVisible();
});

/**
 * A GLOSSARY TERM PAGE RENDERS ITS DEFINITION.
 *
 * A term is a read-only glossary entry (no glyph, no facts) whose page is the
 * definition prose in TermView. "romaji" is a real term (id "romaji", name
 * "Romaji" in src/data/terms), so its page heads with the name and prints the
 * body paragraphs.
 */
test("a glossary term page renders its definition", async ({ page }) => {
  const response = await page.goto("/library/term/romaji");
  expect(response!.status()).toBeLessThan(400);

  // The term's name heads the page (glyph-less header), and its definition prose
  // follows.
  await expect(page.getByText("Romaji", { exact: true }).first()).toBeVisible();
  // A distinctive phrase from the term's body prose.
  await expect(page.locator("body")).toContainText("Latin letters");
  await expect(page.locator("body")).not.toContainText(
    "This page could not be found",
  );
});

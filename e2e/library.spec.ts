import { test, expect } from "./helpers/app";
import { COUNTER_KIND, LIB_ENTRIES, KINDS, libEntry } from "@/lib/library/entries";
import { entryHref } from "@/lib/library/href";

/**
 * "Library entry pages render for every kind, including the readable URLs."
 *
 * The Library is served by ONE catch-all route, `src/app/library/[...entry]`,
 * which decides what it was handed by the number of segments: two means a
 * readable /library/<segment>/<slug>, one means a percent-encoded entry id.
 * A miss on either shape is `notFound()`. That makes it exactly the sort of
 * route the historical "a route change made the app fail to boot" regression
 * lived in, and nothing in a pure logic suite renders it.
 */

/**
 * One readable URL per URL SEGMENT. Note there are nine segments for eight
 * kinds: `kana` splits into `hiragana` and `katakana` in the URL, because a
 * kana entry's slug is its romaji and あ and ア would otherwise collide.
 *
 * These are written out rather than derived so that the test states the URL
 * contract in the form a user would type it. The derived sweep below is what
 * guards against them drifting out of the data.
 */
const READABLE: Array<{ url: string; heading: string; crumb: string; wordPage?: boolean }> = [
  { url: "/library/hiragana/a", heading: "a", crumb: "Kana" },
  { url: "/library/katakana/a", heading: "a", crumb: "Kana" },
  { url: "/library/radical/一", heading: "one", crumb: "Radicals" },
  { url: "/library/kanji/生", heading: "life", crumb: "Kanji" },
  // Word pages no longer use h1 — the header is just the large glyph.
  { url: "/library/word/明白", heading: "obvious", crumb: "Words", wordPage: true },
  { url: "/library/grammar/te-request", heading: "please do X", crumb: "Grammar" },
  { url: "/library/transitivity/開く-開ける", heading: "open", crumb: "Verb pairs" },
  { url: "/library/writing-rule/dakuten", heading: "", crumb: "Writing rules" },
  { url: "/library/term/jlpt", heading: "JLPT", crumb: "Terms" },
];

for (const entry of READABLE) {
  test(`library entry renders at ${entry.url}`, async ({ page }) => {
    const response = await page.goto(entry.url);
    expect(response!.status(), `${entry.url} did not serve`).toBeLessThan(400);

    // The redesigned entry pages carry no h1 — the header is a large glyph/name
    // div inside the glass entry surface (an <article>). Its presence is the
    // "rendered, not 404" signal; the heading TEXT (a meaning/reading/name) now
    // lives in the body of that surface.
    await expect(page.locator("article").first()).toBeVisible();
    if (entry.heading) await expect(page.locator("body")).toContainText(entry.heading);

    // The breadcrumb names the KIND, which is how the page says which shelf it
    // belongs to. This is the assertion that would catch a slug being served by
    // the wrong kind.
    await expect(page.locator("body")).toContainText(`Library`);
    await expect(page.locator("body")).toContainText(entry.crumb);

    await expect(page.locator("body")).not.toContainText(
      "This page could not be found",
    );
  });
}

/**
 * Every KIND is reachable, derived from the app's own entry list rather than
 * from the table above. If a kind ever stops minting hrefs — or mints one the
 * route cannot resolve — this fails even though the hardcoded URLs still pass.
 */
test("every library kind mints a working href", async ({ page }) => {
  for (const kind of KINDS) {
    const sample = LIB_ENTRIES.find((e) => e.kind === kind);
    expect(sample, `no library entry exists for kind ${kind}`).toBeTruthy();

    const href = entryHref(sample!.id);
    const response = await page.goto(href);
    expect(
      response!.status(),
      `kind ${kind} minted ${href}, which did not serve`,
    ).toBeLessThan(400);
    // No entry kind uses an h1 anymore, and the redesign REMOVED the per-page
    // "Data sources" attribution (it now lives once in the global sidebar as
    // "About the data"). The uniform "rendered entry page, not a 404 shell"
    // signal every kind still carries is the entry breadcrumb — a "Library" link
    // that every resolved entry page renders inside <main> as its first element
    // (both the [...entry] article views and the /library/primitive page). It is
    // present iff the route RESOLVED to a real entry page and absent on a
    // notFound, which is exactly what this test guards. It is scoped to <main> so
    // it is the breadcrumb link, not the sidebar's own "Library" nav link (that
    // lives in the navigation landmark, outside main).
    await expect(
      page.getByRole("main").getByRole("link", { name: "Library", exact: true }).first(),
      `kind ${kind} at ${href} rendered no entry surface`,
    ).toBeVisible();
  }
});

// REMOVED: two word-page tests — "a word has one clear Forms panel with its class
// in the header and audio on each form" (知る) and "a な-adjective word page shows
// its form before a noun" (静か). The meaning-model redesign replaced the word page
// with CharacterEntryView, which shows reading/meaning and the kanji the word is
// written with but NO conjugation Forms panel and NO word-class note
// (word-form-fan.tsx and word-class-note.tsx were deleted). Verb/adjective
// conjugation now lives only on the grammar pattern pages, so there is no Forms
// panel to assert on a plain word page — the behaviour was removed, tests deleted.

/**
 * Counter pages no longer have a "Counter" TermLink in the header (the word-style
 * flat header replaced it). Verify the counter page renders its reading/meaning
 * panel (the new way counter pages show their content).
 */
test("a counter page renders its reading and meaning", async ({ page }) => {
  const counter = LIB_ENTRIES.find((e) => e.kind === COUNTER_KIND && e.sub === "Counter");
  expect(counter, "no counter entry with a 'Counter' sub in this build").toBeTruthy();

  await page.goto(entryHref(counter!.id));
  // CounterEntryView shows a counted form under a "How you say it" section (the
  // reading + meaning), with the accent eyebrow.
  await expect(page.getByText("How you say it", { exact: true })).toBeVisible();
  // The type label under the header reads "counter" (plain text, not a link).
  await expect(page.getByText("counter", { exact: true })).toBeVisible();
});

/**
 * The legacy one-segment shape still resolves. Both shapes share a route, so a
 * change to either can silently break the other.
 */
test("the percent-encoded entry-id URL still resolves", async ({ page }) => {
  const response = await page.goto(`/library/${encodeURIComponent("kanji:生")}`);
  expect(response!.status()).toBeLessThan(400);
  // The redesigned kanji page has no h1; 生's meaning ("life") appears in its body
  // ("It means life."), inside the rendered glass entry surface.
  await expect(page.locator("article").first()).toBeVisible();
  await expect(page.locator("body")).toContainText("life");
});

/** A slug that names nothing must 404, not 500 and not render an empty page. */
test("an unknown library slug is a 404", async ({ page }) => {
  const response = await page.goto("/library/kanji/nope");
  expect(response!.status()).toBe(404);
  await expect(page.locator("body")).toContainText("This page could not be found");
});

test("an unknown library kind is a 404", async ({ page }) => {
  const response = await page.goto("/library/nonsense/生");
  expect(response!.status()).toBe(404);
});

/**
 * The shelf itself. `libEntry` is the lookup the page uses, so this also proves
 * the module the route depends on is loadable in the browser bundle.
 */
test("the library shelf renders and links into entries", async ({ page }) => {
  await page.goto("/library");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Library");

  const first = LIB_ENTRIES.find((e) => e.kind === "kana")!;
  expect(libEntry(first.id)).toBeTruthy();

  await page.goto(entryHref(first.id));
  // The entry page itself has no h1 (its header is a glyph/name div); the glass
  // entry surface rendering is the proof the link resolved to a real entry.
  await expect(page.locator("article").first()).toBeVisible();
});

test("each Library shelf can collapse and reopen", async ({ page }) => {
  await page.goto("/library?kind=kana");

  const firstEntry = page.locator('a[href="/library/hiragana/a"]');
  const collapse = page.getByRole("button", {
    name: /Collapse Hiragana · vowels あ/i,
  });
  await expect(collapse).toHaveAttribute("aria-expanded", "true");
  await expect(firstEntry).toBeVisible();

  await collapse.click();
  const expand = page.getByRole("button", {
    name: /Expand Hiragana · vowels あ/i,
  });
  await expect(expand).toHaveAttribute("aria-expanded", "false");
  await expect(firstEntry).toHaveCount(0);

  await expand.click();
  await expect(firstEntry).toBeVisible();
});

test("the complete library and current-session nav are present before hydration", async ({
  browser,
  baseURL,
}) => {
  // A regression in the URL-state plumbing put the entire page behind
  // `Suspense fallback={null}`. On every reload the sidebar arrived alone,
  // followed by shelves and then the docked controls. No JavaScript is the
  // strict proof that title, controls, and shelf all ship in the first response.
  const context = await browser.newContext({ javaScriptEnabled: false, baseURL });
  await context.addCookies([
    {
      name: "saku-current-run-count",
      value: "2",
      url: baseURL!,
    },
  ]);
  const page = await context.newPage();

  await page.goto("/library?kind=kana");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Library");
  await expect(page.getByPlaceholder(/Search anything/)).toBeVisible();
  // Browser-only progress is unknowable in the server response. The action bar
  // waits for that real history rather than flashing actions computed from an
  // empty stand-in.
  await expect(page.getByRole("button", { name: /Add to list/ })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /Teach me/ })).toHaveCount(0);
  await expect(page.getByText("あ", { exact: true })).toBeVisible();
  // With viewport-first rendering, distant section bodies are deferred; the
  // first viewport content must still be present in server HTML.
  await expect(page.getByText("あ", { exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: /Current sessions/ })).toContainText(
    "2",
  );

  const serverY = await page
    .getByText("あ", { exact: true })
    .evaluate((node) => node.getBoundingClientRect().y);
  const serverSearch = await page
    .getByPlaceholder(/Search anything/)
    .evaluate((node) => {
      const { x, y, width, height } = node.getBoundingClientRect();
      return { x, y, width, height };
    });

  // The old content-visibility placeholder gave every distant section a fake
  // 320px body. Hydration measured more sections and collapsed those guesses,
  // moving the final kana by hundreds of pixels even though no box was visible.
  const hydratedContext = await browser.newContext({ baseURL });
  await hydratedContext.addCookies([
    {
      name: "saku-current-run-count",
      value: "2",
      url: baseURL!,
    },
  ]);
  const hydratedPage = await hydratedContext.newPage();
  await hydratedPage.goto("/library?kind=kana");
  await hydratedPage.waitForLoadState("networkidle");
  const hydratedY = await hydratedPage
    .getByText("あ", { exact: true })
    .evaluate((node) => node.getBoundingClientRect().y);
  const hydratedSearch = await hydratedPage
    .getByPlaceholder(/Search anything/)
    .evaluate((node) => {
      const { x, y, width, height } = node.getBoundingClientRect();
      return { x, y, width, height };
    });
  expect(hydratedY).toBe(serverY);
  expect(hydratedSearch).toEqual(serverSearch);
  // The action bar is now gated on a hand selection (and de-boxed — no `kq-band`):
  // with nothing picked it stays absent after hydration too, where it used to
  // render for the whole shelf. So the stability this test guards is the SHELF's
  // — the kana and the search box do not move server → hydrated — and no bar
  // appears at all until rows are selected.
  await expect(
    hydratedPage.getByRole("button", { name: /Add to list/ }),
  ).toHaveCount(0);

  await context.close();
  await hydratedContext.close();
});

/**
 * THE FILTER CHIPS SURVIVE A TRIP THROUGH A DETAIL PAGE — including a
 * back → forward → back dance.
 *
 * The chips and the knowledge filter drive the page by changing ONLY the
 * query string of `/library` (kind/state/q). They used to do that with
 * `router.push`, and on Next 16 that has a bfcache hazard: once the App Router
 * preserves and restores this page's tree in an <Activity> boundary — which a
 * back → forward → back through a detail page does — a subsequent same-segment,
 * search-params-only push is silently dropped. The chips went dead until a full
 * reload, while segment-changing links (a tile, the sidebar) kept working.
 *
 * The fix routes those query-only updates through the native History API
 * (window.history.pushState/replaceState), which the App Router docs recommend
 * for exactly this and which is unaffected by the bfcache path. This test is
 * the regression: it drives the failing sequence with REAL clicks and asserts a
 * chip still changes the shelf afterwards.
 */
test("filter chips still work after a back/forward/back through a detail page", async ({
  page,
}) => {
  // SAK-63's second round turned the Kind/Status chip ROWS into two
  // checklist DROPDOWNS (FilterDropdown): a trigger chip ("Kind", "Kind · 1",
  // "Kind · none" depending on how much is checked) opens a popover of
  // checkboxes, Clear unchecks everything, and a single remaining checked
  // item is what still round-trips through the URL as `?kind=word` /
  // `?state=known` (kindsFromParams/statesFromParams — a comma-free single
  // token is read the same as it always was). So narrowing to exactly one
  // kind/status now takes trigger → Clear → check-the-one-item, not a single
  // flat click.
  const openDropdown = (label: string) =>
    page.getByRole("button", { name: new RegExp(`^${label}( · .+)?$`) }).click();
  const clearDropdown = () => page.getByRole("button", { name: "Clear", exact: true }).click();
  const check = (name: string) => page.getByRole("checkbox", { name, exact: true }).check();

  await page.goto("/library?kind=kanji");
  // 人 is the first kanji in curriculum order and always visible at the top.
  await expect(page.locator('a[href="/library/kanji/人"]').first()).toBeVisible();

  // Into a kanji detail, then the back → forward → back cycle that arms the bug.
  await page.locator('a[href="/library/kanji/人"]').first().click();
  await expect(page).toHaveURL(/\/library\/kanji\//);
  await page.goBack();
  await expect(page).toHaveURL(/\?kind=kanji$/);
  await page.goForward();
  await expect(page).toHaveURL(/\/library\/kanji\//);
  await page.goBack();
  await expect(page).toHaveURL(/\?kind=kanji$/);

  // The Kind dropdown must still move the shelf.
  await openDropdown("Kind");
  await clearDropdown();
  await check("Words");
  await page.keyboard.press("Escape");
  await expect(page).toHaveURL(/\?kind=word$/);
  await expect(page.locator('a[href^="/library/word/"]').first()).toBeVisible();

  // And so must the Status dropdown (the other search-params-only control).
  await openDropdown("Status");
  await clearDropdown();
  await check("Known");
  await page.keyboard.press("Escape");
  await expect(page).toHaveURL(/state=known/);

  // Back still steps through the choices the dropdowns pushed. Narrowing to
  // one item is Clear-then-check (two toggles, two pushes) rather than the
  // old chip's one click, so the state one step back is the Status dropdown's
  // own intermediate Clear, still carrying the Kind change — proving the
  // history stack advanced by real pushState calls, not one that silently
  // dropped and left this a no-op. libraryUrl omits `state` entirely for an
  // empty set rather than writing an explicit "none" token (SAK-167 — an
  // empty set IS the unfiltered default), so the intermediate URL is bare.
  await page.goBack();
  await expect(page).toHaveURL(/\?kind=word$/);
});

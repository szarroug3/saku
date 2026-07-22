import { test, expect } from "./helpers/app";
import { LIB_ENTRIES, KINDS, libEntry } from "@/lib/library/entries";
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
const READABLE: Array<{ url: string; heading: string; crumb: string }> = [
  { url: "/library/hiragana/a", heading: "a", crumb: "Kana" },
  { url: "/library/katakana/a", heading: "a", crumb: "Kana" },
  { url: "/library/radical/一", heading: "one", crumb: "Radicals" },
  { url: "/library/kanji/生", heading: "life", crumb: "Kanji" },
  { url: "/library/word/明白", heading: "obvious", crumb: "Words" },
  { url: "/library/grammar/te-request", heading: "please do X", crumb: "Grammar" },
  { url: "/library/transitivity/開く-開ける", heading: "open", crumb: "Verb pairs" },
  { url: "/library/writing-rule/dakuten", heading: "", crumb: "Writing rules" },
  { url: "/library/term/jlpt", heading: "JLPT", crumb: "Terms" },
];

for (const entry of READABLE) {
  test(`library entry renders at ${entry.url}`, async ({ page }) => {
    const response = await page.goto(entry.url);
    expect(response!.status(), `${entry.url} did not serve`).toBeLessThan(400);

    // Exactly one h1, which is the entry's meanings or readings.
    const h1 = page.getByRole("heading", { level: 1 });
    await expect(h1).toHaveCount(1);
    await expect(h1).not.toBeEmpty();
    if (entry.heading) await expect(h1).toContainText(entry.heading);

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
    await expect(
      page.getByRole("heading", { level: 1 }),
      `kind ${kind} at ${href} rendered no heading`,
    ).toHaveCount(1);
  }
});

/**
 * The legacy one-segment shape still resolves. Both shapes share a route, so a
 * change to either can silently break the other.
 */
test("the percent-encoded entry-id URL still resolves", async ({ page }) => {
  const response = await page.goto(`/library/${encodeURIComponent("kanji:生")}`);
  expect(response!.status()).toBeLessThan(400);
  await expect(page.getByRole("heading", { level: 1 })).toContainText("life");
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
  await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
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
  const chip = (name: string) =>
    page.getByRole("button", { name, exact: true });

  await page.goto("/library?kind=kanji");
  await expect(page.getByText("生")).toBeVisible();

  // Into a kanji detail, then the back → forward → back cycle that arms the bug.
  await page.locator('a[href="/library/kanji/生"]').first().click();
  await expect(page).toHaveURL(/\/library\/kanji\//);
  await page.goBack();
  await expect(page).toHaveURL(/\?kind=kanji$/);
  await page.goForward();
  await expect(page).toHaveURL(/\/library\/kanji\//);
  await page.goBack();
  await expect(page).toHaveURL(/\?kind=kanji$/);

  // The kind chip must still move the shelf.
  await chip("Words").click();
  await expect(page).toHaveURL(/\?kind=word$/);
  await expect(page.getByText("Everyday words", { exact: true })).toBeVisible();

  // And so must the knowledge filter (the other search-params-only control).
  await chip("Known").click();
  await expect(page).toHaveURL(/state=known/);

  // Back still steps through the choices the chips pushed.
  await page.goBack();
  await expect(page).toHaveURL(/\?kind=word$/);
});

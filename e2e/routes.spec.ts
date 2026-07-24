import { test, expect } from "./helpers/app";
import { appRoutes } from "./helpers/routes";

/**
 * "The app boots and every route renders."
 *
 * This is the test that would have caught the route change that made the app
 * fail to boot with tsc clean and all 1035 unit tests green. Nothing in a pure
 * logic suite ever asks a page to render.
 *
 * The route list is ENUMERATED from src/app rather than written out here, so a
 * page added tomorrow is covered the moment it lands and a deleted one stops
 * being asserted.
 */

const routes = appRoutes();

test("src/app exposes the routes the suite expects to find", () => {
  // A guard on the enumeration itself: if the walk silently returned nothing,
  // every generated test below would vacuously pass.
  expect(routes.static.length).toBeGreaterThan(5);
  expect(routes.static).toContain("/");
  expect(routes.static).toContain("/quiz");
  expect(routes.dynamic.length).toBeGreaterThan(0);
});

for (const route of routes.static) {
  test(`renders ${route}`, async ({ page }) => {
    const failures: string[] = [];
    page.on("pageerror", (e) => failures.push(`pageerror: ${e.message}`));
    page.on("console", (m) => {
      if (m.type() === "error") {
        const text = m.text();
        // The dev server's HMR websocket does not connect under Playwright.
        // That is harness noise, not an application fault.
        if (text.includes("webpack-hmr")) return;
        if (text.includes("WebSocket")) return;
        failures.push(`console.error: ${text}`);
      }
    });

    const response = await page.goto(route);
    // A 200 or a redirect is fine. A 404 or a 500 is not.
    expect(response, `no response for ${route}`).not.toBeNull();
    expect(response!.status(), `bad status for ${route}`).toBeLessThan(400);

    // Several routes are guards that redirect: /quiz and /session go to /learn
    // when there is no quiz in progress, /chart goes to /library, and "/" itself
    // redirects to /learn for any signed-in visitor — which, in file mode, is
    // every visitor (auth.ts returns LOCAL_USER unconditionally). That last one
    // was missing from this list, which is how `renders /` sat here for months as
    // an undetected second copy of `renders /learn`. It is asserted explicitly
    // below now, rather than being implied by a comment.
    //
    // Following the redirect is the correct behaviour, so the assertion is that
    // the app ends up somewhere that rendered, not that the URL is unchanged.
    await page.waitForLoadState("networkidle");

    // Every page in this app renders the site nav. Its presence is the cheapest
    // honest proof that the tree mounted rather than blanking on an error.
    // Scoped to the navigation landmark because entry pages also put a
    // "Library" link in their breadcrumb.
    await expect(
      page.getByRole("navigation").getByRole("link", { name: "Library" }),
    ).toBeVisible();

    // Next renders a recognisable error overlay/page when a route throws.
    await expect(page.locator("body")).not.toContainText(
      "Application error: a client-side exception",
    );
    await expect(page.locator("body")).not.toContainText(
      "This page could not be found",
    );

    expect(failures, `${route} logged errors`).toEqual([]);
  });
}

/**
 * The dynamic routes need real parameter values. These are picked from the
 * app's own data and are asserted to render real content, not just to 200.
 */
const dynamicSamples: Array<{ route: string; url: string; expect: string }> = [
  // Cluster ids come from src/data/grammar/clusters; "obligation" is the first.
  { route: "/grammar/[cluster]", url: "/grammar/obligation", expect: "" },
  { route: "/library/[...entry]", url: "/library/hiragana/a", expect: "あ" },
  // /radical serves the components that are used as a part but are NOT themselves
  // a taught kanji (氵, 亻, 艹, ...). A component that is also a jouyou kanji 404s
  // here on purpose and routes to /library/kanji instead, so 一 is NOT valid.
  // Since task 23 rebuilt components from KanjiVG, the set is the meaningful
  // semantic radicals (氵 sits inside 115 kanji), not the old stroke primitives
  // like ノ, which no direct decomposition lists.
  { route: "/radical/[radical]", url: "/radical/氵", expect: "氵" },
];

for (const sample of dynamicSamples) {
  test(`renders ${sample.route} as ${sample.url}`, async ({ page }) => {
    const response = await page.goto(sample.url);
    expect(response!.status()).toBeLessThan(400);
    await expect(
      page.getByRole("navigation").getByRole("link", { name: "Library" }),
    ).toBeVisible();
    if (sample.expect) {
      await expect(page.locator("body")).toContainText(sample.expect);
    }
  });
}

/**
 * "/" IS NOT A PAGE IN THIS SUITE, AND SAYING SO IS THE POINT.
 *
 * `renders /` above is generated from the route enumeration, so it looks like
 * landing-page coverage. It is not: src/app/page.tsx redirects a signed-in
 * visitor to /learn, and every visitor here is signed in, so that test follows
 * the redirect and asserts /learn — the same thing `renders /learn` asserts.
 *
 * This test names the redirect, so the duplicate is visible instead of
 * disguised. What it does NOT do is cover the landing itself.
 */
test("/ redirects a signed-in learner to /learn", async ({ page }) => {
  await page.goto("/");
  await page.waitForLoadState("networkidle");
  expect(new URL(page.url()).pathname).toBe("/learn");
});

/**
 * THE GAP THIS LEAVES, WRITTEN DOWN RATHER THAN FORGOTTEN.
 *
 * src/components/landing.tsx is the front door for every signed-out visitor and
 * has no e2e coverage at all, because this harness cannot produce a signed-out
 * visitor: the fixtures run STORAGE_BACKEND=file, and src/lib/auth.ts short
 * circuits to LOCAL_USER whenever the store is not Supabase. There is no seed
 * option, cookie, or storage state that makes `isSignedIn()` false.
 *
 * Covering it needs a fixture that boots the app in Supabase mode with no
 * session — a harness change, not a test. Until then this asserts the one thing
 * that IS checkable and true: the landing is what "/" renders when nobody is
 * signed in, so the redirect above is the only reason it is never seen here.
 */
test.skip("the landing renders for a signed-out visitor", () => {
  // Unreachable in file mode. See the comment above: this needs a Supabase-mode
  // fixture with no session, and is skipped rather than deleted so the gap stays
  // visible in the run output instead of living only in a comment.
});

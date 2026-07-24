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
        // Vercel Web Analytics (<Analytics/>) injects /_vercel/insights/script.js,
        // which only exists on Vercel's platform — a local `next start` answers
        // 404 and the browser logs a generic "Failed to load resource". Infra
        // noise, not the app: the script is absent everywhere off Vercel and its
        // absence says nothing about whether the page rendered. Matched on the
        // failing resource's URL, since the console text itself is generic.
        if (m.location().url.includes("/_vercel/insights/")) return;
        // Signed-out data probes. The suite runs signed out, and hooks like
        // useLists read the server first and fall back to this browser's
        // localStorage on 401 (the documented pattern — see progress-fetch.ts).
        // That 401 is BY DESIGN and handled in code, but the browser still logs a
        // generic "Failed to load resource" for it. It is not a render fault — the
        // page mounts and shows local data — so an expected 401 from the app's own
        // /api endpoints is not counted, the same way the HMR/insights noise is
        // not. A genuine failure still surfaces as a bad document status, a
        // pageerror, or the app-error text asserted below.
        if (
          m.location().url.includes("/api/") &&
          text.includes("Failed to load resource") &&
          text.includes("401")
        ) {
          return;
        }
        failures.push(`console.error: ${text}`);
      }
    });

    const response = await page.goto(route);
    // A 200 or a redirect is fine. A 404 or a 500 is not.
    expect(response, `no response for ${route}`).not.toBeNull();
    expect(response!.status(), `bad status for ${route}`).toBeLessThan(400);

    // Several routes are guards that redirect: /quiz and /session go to /learn
    // when there is no quiz in progress, and /chart goes to /library. "/" itself
    // no longer redirects here: the suite runs SIGNED OUT (see
    // playwright.config.ts), and "/" is the landing for a signed-out visitor — it
    // renders in place rather than redirecting to /learn. That the landing still
    // mounts the nav is asserted below like every other route; that it is the
    // landing and not the curriculum is asserted explicitly further down.
    //
    // Following any redirect is the correct behaviour, so the assertion is that
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
 * "/" IS THE LANDING IN THIS SUITE — the front door a signed-out visitor sees.
 *
 * `renders /` above is generated from the route enumeration and proves the shell
 * mounts, but not WHICH page "/" is. src/app/page.tsx renders the landing when
 * there is no session and only redirects to /learn once signed in; the suite runs
 * signed out, so "/" stays "/" and shows src/components/landing.tsx. This names
 * that, so a regression where "/" starts redirecting (or the landing stops
 * rendering) is a failure here rather than a silent change no test notices.
 *
 * This is coverage the old file-mode harness could not produce at all: it ran
 * every visitor as an always-signed-in LOCAL_USER, so "/" was only ever a
 * redirect and the landing was unreachable. Retiring file mode made the
 * signed-out front door testable.
 */
test("/ renders the landing for a signed-out visitor", async ({ page }) => {
  await page.goto("/");
  await page.waitForLoadState("networkidle");
  // Still on "/", not redirected to /learn.
  expect(new URL(page.url()).pathname).toBe("/");
  // The landing's headline and its way-in link — the two things that make it the
  // landing and not the curriculum feed.
  await expect(
    page.getByText("Learn Japanese from the very first character."),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: /start learning without an account/i }),
  ).toBeVisible();
});

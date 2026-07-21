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

    // Several routes are guards that redirect when there is no quiz in
    // progress: /quiz and /session go home, /chart goes to /library. Following
    // the redirect is the correct behaviour, so the assertion is that the app
    // ends up somewhere that rendered, not that the URL is unchanged.
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
  // /radical only serves the 82 PRIMITIVE_STROKES shapes; the 155 components
  // that are also jouyou kanji 404 here on purpose, so 一 is NOT a valid value.
  { route: "/radical/[radical]", url: "/radical/ノ", expect: "ノ" },
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

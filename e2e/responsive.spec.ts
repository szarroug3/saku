import { test, expect } from "./helpers/app";

/**
 * MOBILE WIDTH IS A REAL VIEWPORT, not just a narrow desktop. The whole suite
 * otherwise runs at the default desktop size, so nothing catches a layout that
 * spills sideways on a phone. This resizes to a common phone width and checks
 * two things on the core screens: the page does not scroll horizontally, and the
 * primary action is still reachable.
 *
 * A little slack (2px) absorbs sub-pixel rounding; anything past that is a real
 * element wider than the screen.
 */
const PHONE = { width: 375, height: 812 };

async function horizontalOverflow(page: import("@playwright/test").Page): Promise<number> {
  return page.evaluate(
    () =>
      document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
}

for (const path of ["/learn", "/library", "/practice", "/lists/import"]) {
  test(`no horizontal overflow at phone width on ${path}`, async ({ page, seed }) => {
    await seed({});
    await page.setViewportSize(PHONE);
    await page.goto(path);
    await page.waitForLoadState("networkidle");
    expect(
      await horizontalOverflow(page),
      `${path} scrolls sideways at ${PHONE.width}px`,
    ).toBeLessThanOrEqual(2);
  });
}

test("the primary lesson action is reachable at phone width", async ({ page, seed }) => {
  await seed({});
  await page.setViewportSize(PHONE);
  await page.goto("/learn");
  // Start is on screen and can begin a session even on a narrow phone.
  const start = page.getByRole("button", { name: "Start", exact: true });
  await expect(start).toBeVisible();
  await start.click();
  await page.waitForURL("**/session");
});

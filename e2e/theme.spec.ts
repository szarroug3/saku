import { test, expect } from "./helpers/app";

/**
 * THEME SWITCHING is a behavior, not a default: picking a theme in Settings must
 * actually re-skin the document. The provider writes the choice to <html> as
 * data-theme (globals.css does the rest), so asserting that attribute is the
 * honest, render-agnostic check that the click did something.
 */
test("choosing a theme applies it to the document", async ({ page, seed }) => {
  await seed({});
  await page.goto("/settings");
  const html = page.locator("html");

  await page.getByRole("button", { name: "Graphite theme" }).click();
  await expect(html).toHaveAttribute("data-theme", "graphite");

  await page.getByRole("button", { name: "Aizome theme" }).click();
  await expect(html).toHaveAttribute("data-theme", "aizome");

  await page.getByRole("button", { name: "Kiri theme" }).click();
  await expect(html).toHaveAttribute("data-theme", "kiri");
});

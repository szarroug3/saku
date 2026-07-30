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

/**
 * A THEME CHOICE OUTLIVES THE TAB. Picking a theme writes it to localStorage
 * (the same store the no-flash script in layout.tsx reads back before first
 * paint), so a reload must come back wearing it, not snap to the kiri default.
 * Signed out, so "persisted" means this browser's own storage.
 */
test("a chosen theme survives a reload", async ({ page, seed }) => {
  await seed({});
  await page.goto("/settings");
  const html = page.locator("html");

  await page.getByRole("button", { name: "Graphite theme" }).click();
  await expect(html).toHaveAttribute("data-theme", "graphite");

  await page.reload();
  await expect(html).toHaveAttribute("data-theme", "graphite");
});

/**
 * ACCENT is a real control, not just a default: picking one re-skins the
 * document (data-accent) and sticks across a reload. The default theme kiri
 * ships magenta, so pick a DIFFERENT accent to prove the click did something.
 */
test("choosing an accent applies it and survives a reload", async ({ page, seed }) => {
  await seed({});
  await page.goto("/settings");
  const html = page.locator("html");

  await page.getByRole("button", { name: "Violet" }).click();
  await expect(html).toHaveAttribute("data-accent", "violet");

  await page.reload();
  await expect(html).toHaveAttribute("data-accent", "violet");
});

/**
 * APPEARANCE (light / dark) is a behavior too: forcing Light must set
 * data-appearance so globals.css paints the light skin, rather than leaving it
 * on the system default. Asserting the attribute is the render-agnostic check.
 */
test("forcing an appearance applies it to the document", async ({ page, seed }) => {
  await seed({});
  await page.goto("/settings");
  const html = page.locator("html");

  await page.getByRole("button", { name: "Light", exact: true }).click();
  await expect(html).toHaveAttribute("data-appearance", "light");

  await page.getByRole("button", { name: "Dark", exact: true }).click();
  await expect(html).toHaveAttribute("data-appearance", "dark");
});

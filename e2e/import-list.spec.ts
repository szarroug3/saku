import { test, expect } from "./helpers/app";

/**
 * IMPORTING A LIST FROM A FILE, END TO END — from the list view, where import
 * now lives (it moved out of Settings).
 *
 * /lists offers "Import a list", which opens /lists/import. That screen reads a
 * plain word-per-line file in the browser, matches each headword against the
 * shipped dictionary, and saves the matches as a list. The routes spec only
 * proved a page renders; this proves the whole flow: the list view links to
 * import, a file goes in, the match report is honest, and pressing Import
 * actually creates the list. Signed out, so the list lands in this browser's
 * own storage. The upload is an inline buffer, so the file's contents live right
 * here with the assertions about them.
 */
test("the list view links to import, and importing a word file creates a list", async ({
  page,
  seed,
}) => {
  await seed({});
  await page.goto("/lists");

  // Import lives with the lists now, not in Settings.
  await page.getByRole("link", { name: /Import a list/i }).click();
  await page.waitForURL("**/lists/import");

  // Three everyday words that are all in the dictionary, one per line.
  await page.locator('input[type="file"]').setInputFiles({
    name: "my-words.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("車\n時間\n電話\n"),
  });

  // The report, before anything is saved: all three matched.
  await expect(page.getByText("3 matched the dictionary")).toBeVisible();

  // Commit the import. The button counts what it will add.
  await page.getByRole("button", { name: /^Import 3$/ }).click();

  // The list now exists.
  await expect(page.getByText(/is now one of your lists/)).toBeVisible();
});

/**
 * ROMAJI HEADWORDS RESOLVE ON IMPORT, by pronunciation, the same way the library
 * search resolves them: a file that says "shito" and "anata" should match 使徒
 * and あなた, not be dismissed as "English, not a word". This is the import twin
 * of the romaji search matching.
 */
test("romaji headwords match by pronunciation on import", async ({ page, seed }) => {
  await seed({});
  await page.goto("/lists/import");

  await page.locator('input[type="file"]').setInputFiles({
    name: "romaji.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("shito\nanata\n"),
  });

  // Both romaji lines resolve to real entries; nothing is left unmatched.
  await expect(page.getByText("2 matched the dictionary")).toBeVisible();
  await page.getByRole("button", { name: /^Import 2$/ }).click();
  await expect(page.getByText(/is now one of your lists/)).toBeVisible();
});

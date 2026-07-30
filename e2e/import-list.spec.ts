import { test, expect } from "./helpers/app";

/**
 * IMPORTING A LIST FROM A FILE, END TO END.
 *
 * /settings/import reads a plain word-per-line file in the browser, matches each
 * headword against the shipped dictionary, and saves the matches as a list. The
 * routes spec only proved the page renders; this proves the whole flow: a file
 * goes in, the match report is honest, and pressing Import actually creates the
 * list. Signed out, so the list lands in this browser's own storage.
 *
 * The upload is an inline buffer, not a fixture on disk, so the file's contents
 * live right here with the assertions about them.
 */
test("importing a word file creates a list of the matches", async ({ page, seed }) => {
  await seed({});
  await page.goto("/settings/import");

  // Three everyday words that are all in the dictionary, one per line — the exact
  // shape the page documents ("a .txt with one word per line").
  await page.locator('input[type="file"]').setInputFiles({
    name: "my-words.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("車\n時間\n電話\n"),
  });

  // The report, before anything is saved: all three matched, none left over.
  await expect(page.getByText("3 matched the dictionary")).toBeVisible();
  await expect(page.getByText(/3 distinct things/)).toBeVisible();

  // Commit the import. The button counts what it will add.
  await page.getByRole("button", { name: /^Import 3$/ }).click();

  // The list now exists — the page says so, naming it from the filename.
  await expect(page.getByText(/is now one of your lists/)).toBeVisible();
});

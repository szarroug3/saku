import { test, expect, drillReady } from "./helpers/app";

/** Import a three-word list and land on the done screen. Shared setup for the
 * two drill tests below. */
async function importThree(page: import("@playwright/test").Page) {
  await page.goto("/lists/import");
  await page.locator('input[type="file"]').setInputFiles({
    name: "my-words.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("車\n時間\n電話\n"),
  });
  await page.getByRole("button", { name: /^Import 3$/ }).click();
  await expect(page.getByText(/is now one of your lists/)).toBeVisible();
}

/**
 * IMPORTING A LIST FROM A FILE, END TO END — from the list view, where import
 * now lives (it moved out of Settings).
 *
 * /lists offers "Import a list", which opens /lists/import. That screen reads a
 * file in the browser, matches each headword against the shipped dictionary, and
 * saves the checked matches as a list. The routes spec only proved a page
 * renders; these prove the flow: the list view links to import, a file goes in,
 * the match report is honest, matched items are a checklist you can prune, and
 * pressing Import creates the list. Signed out, so lists land in this browser's
 * own storage. Uploads are inline buffers, so each file's contents live right
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

  await expect(page.getByText("3 matched the dictionary")).toBeVisible();
  await page.getByRole("button", { name: /^Import 3$/ }).click();
  await expect(page.getByText(/is now one of your lists/)).toBeVisible();
});

/**
 * ROMAJI HEADWORDS RESOLVE ON IMPORT, by pronunciation, like the library search:
 * "shito" and "anata" match 使徒 and あなた, not dismissed as English.
 */
test("romaji headwords match by pronunciation on import", async ({ page, seed }) => {
  await seed({});
  await page.goto("/lists/import");

  await page.locator('input[type="file"]').setInputFiles({
    name: "romaji.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("shito\nanata\n"),
  });

  await expect(page.getByText("2 matched the dictionary")).toBeVisible();
  await page.getByRole("button", { name: /^Import 2$/ }).click();
  await expect(page.getByText(/is now one of your lists/)).toBeVisible();
});

/**
 * A CSV WITH SEVERAL VALUES ON ONE LINE is several items, not one. The importer
 * splits every comma/tab cell into its own candidate: "shito,anata,person,qwerty"
 * is four. Two match by pronunciation, "person" matches by meaning (the word for
 * it), and only the genuine non-word "qwerty" is left out.
 */
test("comma-separated values each become their own item", async ({ page, seed }) => {
  await seed({});
  await page.goto("/lists/import");

  await page.locator('input[type="file"]').setInputFiles({
    name: "test.csv",
    mimeType: "text/csv",
    buffer: Buffer.from("shito,anata,person,qwerty\n"),
  });

  // shito + anata (sound) + person (meaning) resolve; qwerty does not and lands
  // in the didn't-match list rather than being silently dropped as an extra field.
  await expect(page.getByText("3 matched the dictionary")).toBeVisible();
  await expect(page.getByText("qwerty")).toBeVisible();
});

/**
 * THE IMPORTED LIST CAN BE DRILLED, from the done screen's "Go and drill it" and
 * from the list view's Drill button. Both must reach a real drill with questions,
 * not a round that immediately reports zero and offers only a retry.
 */
test("'Go and drill it' drills the imported list", async ({ page, seed }) => {
  await seed({});
  await importThree(page);
  await page.getByRole("button", { name: /Go and drill it/i }).click();
  await page.waitForURL("**/quiz");
  // A real question is on screen, not a 0-question round-complete fork.
  await drillReady(page);
});

test("a list drills from the list view", async ({ page, seed }) => {
  await seed({});
  await importThree(page);
  await page.goto("/lists");
  await page.getByRole("button", { name: "Drill", exact: true }).first().click();
  await page.waitForURL("**/quiz");
  await drillReady(page);
});

/**
 * THE MATCHED ITEMS ARE A CHECKLIST you can prune before importing: unchecking
 * one drops the count the Import button will add.
 */
test("unchecking a matched item lowers the import count", async ({ page, seed }) => {
  await seed({});
  await page.goto("/lists/import");

  await page.locator('input[type="file"]').setInputFiles({
    name: "three.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("車\n時間\n電話\n"),
  });

  // All three start checked, so the button offers all three.
  await expect(page.getByRole("button", { name: /^Import 3$/ })).toBeVisible();

  // Uncheck one match; the button now offers two.
  await page.getByRole("checkbox").first().uncheck();
  await expect(page.getByRole("button", { name: /^Import 2$/ })).toBeVisible();
});

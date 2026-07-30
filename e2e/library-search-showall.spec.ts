import { test, expect } from "./helpers/app";

/**
 * SEARCH SHOWS EVERYTHING IT FOUND.
 *
 * The Library search used to cap each section at eight rows and hide the rest
 * behind a "＋ N more like this" footer. That footer is gone: a search now paints
 * every match under the current scope. This drives a query the search module
 * itself calls out as large (で matches ~142 words) and proves two things: the
 * footer text never appears, and far more than the old cap of eight rows render.
 *
 * Signed out; search runs over the whole reference regardless of what is known,
 * so no seeding of progress is needed.
 */
test("a broad search shows every match, with no '+N more' footer", async ({
  page,
  seed,
}) => {
  await seed({});
  await page.goto("/library");

  // で is a particle every verb's て/で-form and countless words contain, so it
  // lands well past the old eight-row cap.
  await page.getByRole("textbox").first().fill("で");

  // The withheld-results footer is gone entirely.
  await expect(page.getByText(/more like this/)).toHaveCount(0);

  // And the rows really are all there: each speakable result row carries a
  // "Hear …" button, so counting them counts the rendered results. Far more than
  // the old cap of 8 proves the section is no longer truncated.
  await expect
    .poll(async () => page.getByRole("button", { name: /^Hear / }).count())
    .toBeGreaterThan(8);
});

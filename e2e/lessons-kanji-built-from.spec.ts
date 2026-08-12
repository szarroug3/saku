import { test, expect } from "./helpers/app";

/**
 * THE KANJI ENTRY PAGE, on the redesigned content model (CharacterEntryView).
 *
 * The lesson step and the Library page now render the SAME view, so this guards
 * the reference surface: the SHAPE decomposition ("Sub-components", radicals
 * included, each piece a link), the readings (On'yomi / Kun'yomi groups), the
 * role line in the header, and the "Used as a part in" list a component-rich
 * kanji earns.
 *
 * All logged-out Library surfaces, so an empty seed is enough. Targets are
 * distinct from the sibling spec: 明 (= 日 + 月) for shape + readings, 口
 * (radical · kanji · word) for the role line and the used-as-a-part list.
 */

test("the 明 kanji page leads with a linked Sub-components of its shape pieces", async ({
  page,
  seed,
}) => {
  await seed({ seen: [], cfg: {} });
  await page.goto("/library/kanji/明");

  // The SHAPE decomposition 明 = 日 day + 月 month, under the "Sub-components"
  // sub-heading. Both pieces are jōyō kanji with pages of their own, so each is a
  // link. The tile prints the piece's applicable etymology sense (sun / moon —
  // the senses that explain 明 = bright), not the dictionary lead.
  const subComponents = page.getByText("Sub-components", { exact: true }).locator("..");
  await expect(subComponents).toBeVisible();
  await expect(subComponents.getByRole("link", { name: /日/ })).toBeVisible();
  await expect(subComponents.getByRole("link", { name: /月/ })).toBeVisible();
  await expect(subComponents).toContainText("sun");
  await expect(subComponents).toContainText("moon");
});

test("the 明 kanji page renders its readings, grouped on'yomi and kun'yomi", async ({
  page,
  seed,
}) => {
  await seed({ seen: [], cfg: {} });
  await page.goto("/library/kanji/明");

  // Readings show as On'yomi / Kun'yomi groups, each reading beside an example
  // word. A kanji with no rows shows neither group — the guard renders nothing —
  // so the groups' presence is the fact under test. (Apostrophe-agnostic, and the
  // sub-heading carries an info tooltip so the label is not the whole node.)
  await expect(page.getByText(/On.?yomi/).first()).toBeVisible();
  await expect(page.getByText(/Kun.?yomi/).first()).toBeVisible();

  // The shape sits ABOVE the readings — the decomposition is the first read.
  const subBox = await page.getByText("Sub-components", { exact: true }).boundingBox();
  const onBox = await page.getByText(/On.?yomi/).first().boundingBox();
  expect(subBox).not.toBeNull();
  expect(onBox).not.toBeNull();
  expect(subBox!.y).toBeLessThan(onBox!.y);
});

test("a folded character shows every role it plays in its header role line", async ({
  page,
  seed,
}) => {
  await seed({ seen: [], cfg: {} });
  await page.goto("/library/kanji/口");

  // 口 plays all three roles at once — a Kangxi radical, a jōyō kanji, and the
  // word くち — so the header's type line names all three (the redesign dropped
  // the stroke count from it). The middots are U+00B7.
  await expect(page.getByText("radical · kanji · word", { exact: true })).toBeVisible();
});

test("a component-rich kanji shows the shapes built on it under 'Used as a part in'", async ({
  page,
  seed,
}) => {
  await seed({ seen: [], cfg: {} });
  await page.goto("/library/kanji/口");

  // 口 is written inside hundreds of other kanji, so the "Used as a part in"
  // section lists a capped row of linked kanji plus a "· N more" tail. A kanji
  // nothing is built from shows no section, so its presence and links are the fact.
  const usedAsPart = page.getByText("Used as a part in", { exact: true }).locator("..");
  await expect(usedAsPart).toBeVisible();
  await expect(usedAsPart).toContainText("more");
  await expect(usedAsPart.getByRole("link").first()).toBeVisible();
});

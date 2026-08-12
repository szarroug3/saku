import { test, expect, KANA_FACTS, lessonCard, stepToHeadword } from "./helpers/lessons";

/**
 * ONE CHARACTER, THREE ROLES, ON THE SCREEN.
 *
 * The redesign's central claim is that a lesson step teaches every role its
 * character plays, stacked and each under its own eyebrow: 人 is a shape other
 * kanji are built on, a character in its own right, AND a word you can say. On the
 * content model this is CharacterEntryView (src/components/library/character-entry-view.tsx),
 * which renders a labelled "As a radical / As a kanji / As a word" RoleBlock for
 * every role a glyph plays. A regression that dropped a role block leaves the
 * learner never told 人 is a word, and the suite would stay green without this.
 *
 * This is also the only e2e that reaches the curriculum spine at all. Every other
 * lesson spec seeds an empty history, which is day one and therefore kana, and the
 * kana card is a different component on a different scheduler.
 */

test("a folded character's lesson step teaches all three of its roles", async ({
  page,
  seed,
}) => {
  // Kana complete, so the home feed offers the curriculum-spine (vocab) card.
  await seed({ seen: KANA_FACTS, cfg: {} });
  await page.goto("/learn");

  // THE CARD. The spine card is the only one whose tile carries the three-role
  // type label "radical · kanji · word" — a folded character like 人. (The old
  // composite "Radical 1 of 90 · Kanji 1–3 …" eyebrow is gone; the content-model
  // vocab card counts in the neutral "Item N–M of 6,213".)
  const card = lessonCard(page, "radical · kanji · word");
  await expect(card).toHaveCount(1);

  await card.getByRole("button", { name: "Start", exact: true }).click();
  await page.waitForURL("**/session");

  // Step to 人. The walk may open on a spine intro / concept term page first, so
  // this advances until 人's page is on screen and fails loudly if it never is.
  await stepToHeadword(page, "人");

  // ALL THREE ROLE BLOCKS, each under its accent "As a …" eyebrow — the labelled
  // RoleBlock a multi-role glyph gets. Their absence is the regression this guards.
  await expect(page.getByText("As a radical", { exact: true })).toBeVisible();
  await expect(page.getByText("As a kanji", { exact: true })).toBeVisible();
  await expect(page.getByText("As a word", { exact: true })).toBeVisible();

  // The kanji block's own material: the character's meaning.
  await expect(page.locator("body")).toContainText("person");

  // The word block shows the reading being taught (ひと), and the on'yomi group
  // carries the compound readings じん / にん — so all three surface on the page.
  await expect(page.locator("body")).toContainText("ひと");
  await expect(page.locator("body")).toContainText("じん");
  await expect(page.locator("body")).toContainText("にん");

  // Other kanji built on the 人 shape are listed under "Used as a part in".
  await expect(page.getByText("Used as a part in", { exact: true })).toBeVisible();
});

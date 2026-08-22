import { test, expect } from "./helpers/app";

/**
 * THE ETYMOLOGY LAYER ON THE REDESIGNED KANJI ENTRY PAGE.
 *
 * The kanji Library page (/library/kanji/<glyph>) is now CharacterEntryView. Its
 * "As a kanji" block carries the etymology layer:
 *   - "Sub-components" — the etymology components as piece links, the non-semantic
 *     ones tagged with their role (phonetic / …);
 *   - "Etymology" — the glyph-origin prose story;
 *   - "On'yomi" / "Kun'yomi" — the reading groups, each reading with a Hear button.
 *
 * The redesign simplified this from the old KanjiBuiltFrom/OnyomiHint: the prose is
 * shown plain (no Wiktionary credit link, no More/Less clamp toggle), and the piece
 * tiles no longer carry an untaught-component footnote. SAK-137 reintroduced a lent-
 * reading hint on the phonetic piece ("lends か") and gave the semantic piece its own
 * DEFINITION tag, and its follow-up made only the glyph itself a link — the role tag
 * and the lent reading are sibling text next to it, not part of the link. This spec
 * pins what the current page shows. Everything here is a logged-out Library surface,
 * so an empty seed is enough.
 *
 * Targets, chosen against the shipped data (src/data/generated):
 *   神 — phono-semantic with a LONG origin story (示 god + 申 lightning).
 *   河 — phono-semantic: 水 (semantic) + 可 (phonetic) piece links.
 *   中 — a story but NO mappable pieces: Etymology, no Sub-components.
 *   校 — has an on'yomi (こう), so the On'yomi group + Hear button render.
 */

test("a kanji page shows an Etymology story", async ({ page, seed }) => {
  await seed({ seen: [], cfg: {} });
  await page.goto("/library/kanji/神");

  // The prose section is headed by an "Etymology" sub-label; the origin story is
  // the paragraph that follows it. (The old Wiktionary credit link and More/Less
  // clamp toggle were dropped in the redesign — the prose is shown plain.)
  const etymology = page.getByText("Etymology", { exact: true });
  await expect(etymology).toBeVisible();
  await expect(etymology.locator("..").locator("p").last()).not.toBeEmpty();

  // No Wiktionary credit link, no More/Less toggle — those interactive controls
  // were removed with the redesign.
  await expect(page.getByRole("link", { name: "Wiktionary", exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "More", exact: true })).toHaveCount(0);
});

test("the 河 kanji page shows its etymology component pieces, the phonetic one tagged", async ({
  page,
  seed,
}) => {
  await seed({ seen: [], cfg: {} });
  await page.goto("/library/kanji/河");

  // The pieces sit under the "Sub-components" sub-label.
  const builtFromLbl = page.getByText("Sub-components", { exact: true });
  await expect(builtFromLbl).toBeVisible();
  const builtFrom = builtFromLbl.locator("..");

  // 河 = 水 (semantic) + 可 (phonetic). Only the glyph itself is a link now (SAK-137
  // follow-up) — the role tag and the lent reading sit beside it as plain text, not
  // inside the link, so a link's accessible name is just the bare glyph.
  await expect(builtFrom.getByRole("link", { name: "水", exact: true })).toBeVisible();
  const phoneticLink = builtFrom.getByRole("link", { name: "可", exact: true });
  await expect(phoneticLink).toBeVisible();

  // The phonetic piece's row carries the lent reading and the "phonetic" tag as
  // sibling text beside the link, not inside it — the tag renders visually
  // uppercase via CSS only, so its DOM text stays lowercase.
  const phoneticRow = phoneticLink.locator("..");
  await expect(phoneticRow).toContainText("lends か");
  await expect(phoneticRow).toContainText("phonetic");

  // The semantic piece's row carries the "definition" tag the same way.
  const semanticRow = builtFrom.getByRole("link", { name: "水", exact: true }).locator("..");
  await expect(semanticRow).toContainText("definition");
});

test("the 中 kanji page shows an Etymology story but no sub-component pieces", async ({
  page,
  seed,
}) => {
  await seed({ seen: [], cfg: {} });
  await page.goto("/library/kanji/中");

  // 中 is a pictograph with a glyph-origin story but no mappable pieces, so the
  // Etymology section stands alone and the Sub-components list never renders.
  await expect(page.getByText("Etymology", { exact: true })).toBeVisible();
  await expect(page.getByText("Sub-components", { exact: true })).toHaveCount(0);
});

test("the 校 kanji page shows an On'yomi group with a Hear button", async ({
  page,
  seed,
}) => {
  await seed({ seen: [], cfg: {} });
  await page.goto("/library/kanji/校");

  // 校 is read こう inside compounds, so the On'yomi group renders. The sub-label
  // carries an (i) help icon, so match it non-exactly rather than by exact text.
  await expect(page.getByText("On’yomi", { exact: false }).first()).toBeVisible();
  // Each reading has a speaker button whose accessible name starts with "Hear".
  await expect(page.getByRole("button", { name: /Hear/ }).first()).toBeVisible();
});

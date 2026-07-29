import {
  test,
  expect,
  STEADY_CFG,
  type Page,
} from "./helpers/app";

/**
 * GRID and MATCH-PAIRS — the two homogeneous HEADED boards (task #33).
 *
 * Both screens deal a board whose every card asks ONE response of ONE source
 * type, named in a one-line header. Per src/lib/quiz-config.tsx's
 * normalizeConfig, neither mode has a per-mode response chooser any more: a
 * stored config's pairResponses/gridResponses are DISCARDED and pinned to the
 * full set (allPairResponses / allGridResponses) on every load. So the thing
 * under test is exactly that homogeneous, full-set behaviour: a kana selection
 * produces one board — "Kana → Romaji" for Grid, "Kana ↔ Romaji" for Pairs —
 * carrying every seeded relationship, not a narrowed subset.
 *
 * WHY THIS FILE INLINES ITS OWN START. helpers/app.ts's startPractice waits on
 * `.kq-glyph`, the drill halo's glyph span. Grid and Pairs render no halo — a
 * grid sheet of typed cells, a pairs grid of match buttons — so drillReady
 * would hang. Entry here waits on each board's own root instead.
 *
 * WHY KANA. Kana is the one subject whose whole relationship is a single
 * (source × response) pair — the glyph and its romaji — so a kana-only
 * selection yields exactly ONE headed board and nothing else. That makes "one
 * homogeneous board, full set" a clean, countable assertion. A pool of six
 * (≤ BEHAVIOR.pairsPerBoard = 8) also keeps Pairs to a single physical board,
 * so all six relationships are on screen at once.
 */

/** Six hiragana with DISTINCT romaji, so a glyph identifies exactly one fact
 * and a romaji cell is never ambiguous with another on the board. */
const KANA = ["あ", "い", "う", "え", "お", "か"] as const;
const KANA_FACTS = KANA.map((k) => `kana:${k}/reading`);

/** The romaji reveal for each kana — kanaQuestions has no answerReveal, so
 * revealFor(fact, "jp2en") falls back to answerOf, which is this romaji. That
 * is the exact string the answer cell / grid card grades against. */
const ROMAJI: Record<string, string> = {
  あ: "a",
  い: "i",
  う: "u",
  え: "e",
  お: "o",
  か: "ka",
};

/**
 * Seed a kana pool in the given mode and enter its board from Practice.
 *
 * Start is the ordinary Practice launcher — enabled here because six seen kana
 * make a non-empty pool and (for pairs) a playable ≥2-pair board. After the nav
 * we wait on the board root rather than a halo, since these screens have none.
 */
async function enterBoard(
  page: Page,
  seed: (options: { seen?: string[]; cfg?: Record<string, unknown> }) => Promise<void>,
  mode: "grid" | "pairs",
): Promise<void> {
  await seed({ seen: KANA_FACTS, cfg: { ...STEADY_CFG, mode } });
  await page.goto("/practice");
  const start = page.getByRole("button", { name: "Start", exact: true });
  await expect(start).toBeEnabled();
  await start.click();
  await page.waitForURL("**/quiz");
}

// The grid sheet's cards, each a typed glyph→answer cell (src/components/quiz/
// grid-screen.tsx). One `.kq-gcard` per askable fact.
const gridCards = (page: Page) => page.locator(".kq-grid-sheet .kq-gcard");
// The first child span of a card is its glyph (no colour class; see the screen).
const gridGlyphs = (page: Page) => page.locator(".kq-grid-sheet .kq-gcard > span:first-child");
// The pairs board is the only grid-cols-4 container; its buttons are the cells.
const pairCells = (page: Page) => page.locator(".grid-cols-4 button");

test("Grid mode deals one homogeneous Kana → Romaji board carrying the full response set", async ({
  page,
  seed,
}) => {
  await enterBoard(page, seed, "grid");

  // The board renders as a sheet of typed cells.
  await expect(gridCards(page).first()).toBeVisible();

  // ONE headed board, and its header names the single (source × response) the
  // whole sheet asks. Grid uses the → arrow (a one-directional typed card); the
  // per-board counter is absent because there is only one board.
  await expect(page.getByText("Kana → Romaji", { exact: true })).toBeVisible();

  // Full set, homogeneous: one card per seeded kana, no more, no fewer — the
  // proof that Grid pinned gridResponses to the whole set rather than a subset,
  // and that a kana selection collapses to exactly one board.
  await expect(gridCards(page)).toHaveCount(KANA.length);

  const glyphs = (await gridGlyphs(page).allInnerTexts()).map((t) => t.trim());
  expect(new Set(glyphs)).toEqual(new Set(KANA));
});

test("Grid mode grades a correct cell as right and locks it", async ({
  page,
  seed,
}) => {
  await enterBoard(page, seed, "grid");
  await expect(gridCards(page).first()).toBeVisible();

  // Answer the FIRST card. Its glyph identifies the kana (deck order is
  // shuffled, so we read what's actually there rather than assume a position),
  // and the romaji map is the correct answer for it.
  const first = gridCards(page).first();
  const glyph = (await first.locator("span").first().innerText()).trim();
  const answer = ROMAJI[glyph];
  expect(answer, `no romaji known for the rendered glyph "${glyph}"`).toBeTruthy();

  const box = first.locator("input");
  await box.fill(answer);
  // The cell is a <form>; Enter submits and runs the grid check().
  await box.press("Enter");

  // A correct cell locks green and disables its input — the permanent record
  // that it graded right (the shake/tint is transient, the lock is not).
  await expect(first).toHaveClass(/kq-gcard-right/);
  await expect(box).toBeDisabled();
});

test("Match-pairs deals a Kana ↔ Romaji board carrying the full relationship set", async ({
  page,
  seed,
}) => {
  await enterBoard(page, seed, "pairs");

  // The board renders as a grid of match cells.
  await expect(pairCells(page).first()).toBeVisible();

  // ONE headed board; Pairs uses the ↔ arrow because a match is bidirectional.
  await expect(page.getByText("Kana ↔ Romaji", { exact: true })).toBeVisible();

  // Full set: every relationship is a pair of cells (glyph side + romaji side),
  // so six kana is twelve cells, all on one physical board (≤ pairsPerBoard).
  await expect(pairCells(page)).toHaveCount(KANA.length * 2);

  // Both faces of every relationship are present — the glyphs and their romaji.
  const texts = (await pairCells(page).allInnerTexts()).map((t) => t.trim());
  for (const kana of KANA) {
    expect(texts, `missing glyph cell for ${kana}`).toContain(kana);
    expect(texts, `missing romaji cell for ${kana}`).toContain(ROMAJI[kana]);
  }
});

test("Match-pairs matches a correct kana ↔ romaji pair", async ({
  page,
  seed,
}) => {
  await enterBoard(page, seed, "pairs");
  await expect(pairCells(page).first()).toBeVisible();

  // Read the board once: which cell holds which text. Matching one pair needs a
  // glyph cell and its own romaji cell, found by text so shuffle can't fool us.
  const texts = (await pairCells(page).allInnerTexts()).map((t) => t.trim());
  const glyphIdx = texts.findIndex((t) => (KANA as readonly string[]).includes(t));
  expect(glyphIdx, "no kana glyph cell on the board").toBeGreaterThanOrEqual(0);
  const kana = texts[glyphIdx];
  const answerIdx = texts.findIndex((t) => t === ROMAJI[kana]);
  expect(answerIdx, `no romaji cell "${ROMAJI[kana]}" for ${kana}`).toBeGreaterThanOrEqual(0);

  const glyphCell = pairCells(page).nth(glyphIdx);
  const answerCell = pairCells(page).nth(answerIdx);

  // Pick the glyph, then its romaji: opposite kinds of the SAME relationship is
  // a match, and a correct match fades both cells to the spent state
  // (opacity 0.18, no longer a target). Only one pair is matched, so the board
  // does not auto-advance and there is no timing race to wait out.
  await glyphCell.click();
  await answerCell.click();

  await expect(glyphCell).toHaveClass(/opacity-\[0\.18\]/);
  await expect(answerCell).toHaveClass(/opacity-\[0\.18\]/);
});

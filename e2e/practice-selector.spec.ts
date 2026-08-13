import { test, expect, STEADY_CFG } from "./helpers/app";
import { kanaFact } from "@/data/characters";

/**
 * PRACTICE SETUP — the "What to practice" selector (#28 type pruning) and the
 * "How to ask" panel (#30), asserted against what /practice ACTUALLY renders.
 *
 * IMPORTANT REALITY CHECK (read before extending this file):
 *
 * The task brief described a source-based "How to ask" selector with a sources
 * row (Japanese / Japanese-sentence / English), Prompt / Response / Answer rows,
 * and an inferred DIRECTION label. That editor is NOT on the Practice page. The
 * rendered QuizOptionsFields (src/components/practice/quiz-options.tsx) is
 * collapsed to two knobs: Mode and Length. Everything else about how to ask —
 * responses, answer format, direction, and the prompt format — is either fixed
 * on and automatic or a Settings-page preference. There is no direction label
 * anywhere on /practice: howSentence (start-bar.tsx) states mode, length and
 * prompt format only, and enabledDirs (ask-config.ts) is computed but never
 * shown. So this file tests the controls that exist, not the ones the brief
 * assumed.
 *
 * The ONE surviving "how to ask" lever a test can pin through config is the
 * `audioPrompts` boolean. normalizeConfig (quiz-config.tsx) REGENERATES cfg.ask
 * from a derived audioPrompts on every load, so a hand-seeded granular `ask`
 * combo does not survive — only its effect on that boolean does. Every seed here
 * therefore drives audioPrompts, scope, types, mode and length, all of which are
 * real, rendered, and stable.
 *
 * Signed out, state seeded via localStorage before the first navigation (the
 * `seed` fixture). No sleeps: every wait is an expect() on rendered text or an
 * enabled/disabled state.
 */

// Hiragana vowels — simple, common, distinct. Five so a Match-pairs board is
// playable (a board needs at least two pairs) and so type counts read clearly.
const HIRAGANA = ["あ", "い", "う", "え", "お"];
const HIRAGANA_FACTS = HIRAGANA.map((c) => kanaFact(c));
// A kanji meaning fact, to give the Kind row a SECOND lit type to narrow with.
const KANJI_FACT = "kanji:亜/meaning";

// The Start bar carries the stable [data-start-bar] hook (de-box dropped the old
// kq-band class). howSentence renders inside it only while Start is ENABLED (a
// disabled bar shows the reason instead), so a test that reads howSentence must
// first put the page in a startable state.
function startBar(page: import("@playwright/test").Page) {
  return page.locator("[data-start-bar]");
}

// ---------------------------------------------------------------------------
// What to practice — scope presets (#28)

test("scope presets render and switch the panel below them", async ({
  page,
  seed,
}) => {
  await seed({ seen: HIRAGANA_FACTS, cfg: STEADY_CFG });
  await page.goto("/practice");

  // All three scope presets are present.
  const everything = page.getByRole("button", { name: "Everything I know" });
  const lists = page.getByRole("button", { name: "Lists" });
  const custom = page.getByRole("button", { name: "Pick what I want" });
  await expect(everything).toBeVisible();
  await expect(lists).toBeVisible();
  await expect(custom).toBeVisible();

  // Everything is the default scope, so its Kind row is on screen.
  await expect(page.getByText("Kind", { exact: true })).toBeVisible();

  // Switching to Lists swaps the Kind row for the List row. Logged out there are
  // no saved lists, so the empty-state line is the honest signal the panel
  // changed — asserting content, not styling.
  await lists.click();
  await expect(page.getByText("You haven't made any lists yet.")).toBeVisible();
  await expect(page.getByText("Kind", { exact: true })).toHaveCount(0);

  // Back to Everything restores the Kind row.
  await everything.click();
  await expect(page.getByText("Kind", { exact: true })).toBeVisible();
});

// ---------------------------------------------------------------------------
// What to practice — type chips and pruning (#28)

test("a type with material is selectable; one with none is disabled", async ({
  page,
  seed,
}) => {
  // Only hiragana is seeded, so only the Hiragana type has anything to drill.
  await seed({ seen: HIRAGANA_FACTS, cfg: STEADY_CFG });
  await page.goto("/practice");

  // Hiragana holds facts: its chip is enabled. Katakana holds none in this
  // scope: its chip is present (the type exists in the registry) but disabled —
  // that greying-out IS the pruning, a type with a 0 count can't be drilled.
  const hiragana = page.getByRole("button", { name: /Hiragana/ });
  const katakana = page.getByRole("button", { name: /Katakana/ });
  await expect(hiragana).toBeEnabled();
  await expect(katakana).toBeDisabled();
});

test("selecting a Kind narrows the run to that kind", async ({ page, seed }) => {
  // Two lit types: Hiragana and Kanji. Picking one narrows the pool to it.
  await seed({ seen: [...HIRAGANA_FACTS, KANJI_FACT], cfg: STEADY_CFG });
  await page.goto("/practice");

  // No kind chosen yet — the caption says every kind is included.
  await expect(page.getByText(/No kind picked/)).toBeVisible();

  const hiragana = page.getByRole("button", { name: /Hiragana/ });
  const kanji = page.getByRole("button", { name: /Kanji/ });
  await expect(hiragana).toBeEnabled();
  await expect(kanji).toBeEnabled();

  // Pick Hiragana: the caption now names exactly what will be drilled, and the
  // "every kind" fallback is gone. This is the visible narrowing (types ∩ scope).
  await hiragana.click();
  await expect(page.getByText("Drilling Hiragana.")).toBeVisible();
  await expect(page.getByText(/No kind picked/)).toHaveCount(0);

  // Narrowing to a non-empty type keeps the run startable.
  const start = page.getByRole("button", { name: "Start", exact: true });
  await expect(start).toBeEnabled();
});

// ---------------------------------------------------------------------------
// Start enabled / disabled

test("Start is disabled with nothing selected, and says so", async ({
  page,
  seed,
}) => {
  // No facts known → count 0 → Start disabled with the "nothing selected" reason.
  await seed({ seen: [], cfg: STEADY_CFG });
  await page.goto("/practice");

  const start = page.getByRole("button", { name: "Start", exact: true });
  await expect(start).toBeDisabled();
  await expect(page.getByText(/Nothing is selected/)).toBeVisible();
});

test("Start is enabled once material and a valid drill config exist", async ({
  page,
  seed,
}) => {
  await seed({ seen: HIRAGANA_FACTS, cfg: STEADY_CFG });
  await page.goto("/practice");

  const start = page.getByRole("button", { name: "Start", exact: true });
  await expect(start).toBeEnabled();
});

// ---------------------------------------------------------------------------
// How to ask — the prompt-format knob (audioPrompts), read off the Start bar

test("audio off shows a Text-only prompt in the run summary", async ({
  page,
  seed,
}) => {
  await seed({
    seen: HIRAGANA_FACTS,
    cfg: { ...STEADY_CFG, audioPrompts: false },
  });
  await page.goto("/practice");

  // Start is enabled, so the bar shows howSentence rather than a reason.
  await expect(page.getByRole("button", { name: "Start", exact: true })).toBeEnabled();
  const bar = startBar(page);
  await expect(bar).toContainText("Text");
  // Text-only must NOT claim audio.
  await expect(bar).not.toContainText("audio");
});

test("audio on adds audio to the prompt in the run summary", async ({
  page,
  seed,
}) => {
  await seed({
    seen: HIRAGANA_FACTS,
    cfg: { ...STEADY_CFG, audioPrompts: true },
  });
  await page.goto("/practice");

  await expect(page.getByRole("button", { name: "Start", exact: true })).toBeEnabled();
  await expect(startBar(page)).toContainText("Text & audio");
});

// ---------------------------------------------------------------------------
// How to ask — Mode selector, reflected live in the run summary

test("choosing a Mode updates the run summary", async ({ page, seed }) => {
  await seed({ seen: HIRAGANA_FACTS, cfg: STEADY_CFG });
  await page.goto("/practice");

  // Default is Drill.
  const bar = startBar(page);
  await expect(bar).toContainText("Drill");

  // Switch to Match pairs: five kana make a playable board, so Start stays
  // enabled and the summary re-reads the mode.
  await page.getByRole("button", { name: "Match pairs" }).click();
  await expect(page.getByRole("button", { name: "Start", exact: true })).toBeEnabled();
  await expect(bar).toContainText("Match pairs");
});

// ---------------------------------------------------------------------------
// How to ask — Length selector, reflected live in the run summary

test("choosing a Length updates the run summary", async ({ page, seed }) => {
  await seed({ seen: HIRAGANA_FACTS, cfg: STEADY_CFG });
  await page.goto("/practice");

  const bar = startBar(page);
  // STEADY_CFG pins endless.
  await expect(bar).toContainText("Endless");

  // Limited defaults to Full coverage (see defaultConfig limType "cov"). The
  // "Full coverage" SmallBtn lives in the options card, not the bar, so asserting
  // on the bar keeps this about the summary the button drives, not the button.
  await page.getByRole("button", { name: "Limited" }).click();
  await expect(bar).toContainText("Full coverage");

  // Switching to Count caps the run and the summary counts questions. `exact`
  // because a "本 Counters" kind chip also contains the substring "Count".
  await page.getByRole("button", { name: "Count", exact: true }).click();
  await expect(bar).toContainText("questions");
});

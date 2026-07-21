import {
  test,
  expect,
  STEADY_CFG,
  direction,
  style,
  startPractice,
  optionButtons,
  answeredPill,
  type Page,
} from "./helpers/app";
import { factInfo } from "@/lib/facts";
import type { FactId } from "@/types";

/**
 * "No question gives itself away."
 *
 * Two invariants, checked on every card a run produces:
 *
 *   1. the prompt must never appear among its own options
 *   2. no two options may render identical text
 *
 * Invariant 1 is the historical bug "a multiple-choice card offered the prompt
 * itself as one of the options". Invariant 2 is its quieter sibling: two options
 * reading the same thing make the card unanswerable, because picking the one the
 * grader did not have in mind marks a learner wrong for being right.
 *
 * These walk MANY cards rather than one, because both faults depend on which
 * distractors `buildMcOptions` happened to draw, and it draws with
 * `Math.random()`. The kanji pool below is picked to make a duplicate LIKELY if
 * one is possible, since kanji meanings overlap across characters.
 */

const CARDS = 12;

/**
 * The expected answer labels for a fact, read from the app's own registry.
 *
 * Used ONLY to advance the drill, never to assert grading — the grading specs
 * deliberately hardcode their expectations instead, so that they cannot agree
 * with a broken registry. Here the answer key just keeps the walk moving.
 */
function answersOf(fact: string): readonly string[] {
  return factInfo(fact as FactId)?.answers ?? [];
}

function glyphOf(fact: string): string {
  return factInfo(fact as FactId)?.glyph ?? "";
}

function meaningOf(fact: string): string {
  return factInfo(fact as FactId)?.meaning ?? "";
}

/**
 * Which option labels would be right for the card currently on screen.
 *
 * The prompt identifies the fact within the seeded pool — every pool here is
 * small and collision-free so that it can. Which SIDE the prompt is depends on
 * the direction and on the subject (a transitivity card is prompted by its
 * English sentence, a kana card by its romaji), so the fact is found by
 * matching the prompt against any of its faces, and every other face is then
 * accepted as a correct label.
 */
function correctLabelFor(prompt: string, pool: string[]): string[] {
  const faces = (f: string) => [glyphOf(f), meaningOf(f), ...answersOf(f)];
  const fact = pool.find((f) => faces(f).includes(prompt));
  if (!fact) return [];
  return faces(fact).filter((face) => face && face !== prompt);
}

/** Visible option labels with the trailing index badge stripped. */
async function optionLabels(page: Page): Promise<string[]> {
  const raw = await optionButtons(page).allInnerTexts();
  return raw.map((t) => t.trim().split("\n")[0].trim());
}

/**
 * Walk `cards` multiple-choice questions, asserting the invariants on each.
 *
 * Every card is answered CORRECTLY, and that is a deliberate timing decision
 * rather than a nicety. The drill re-keys the halo on `${rt.asked}-${q.tries}`,
 * so a WRONG answer remounts it immediately — while the reveal is still up and
 * the card is still `waiting` and ignoring clicks. Only a right answer leaves
 * the remount to mean "the next question was drawn", which makes waiting for
 * the old glyph node to detach an exact signal instead of a race. No sleeps.
 */
async function walkCards(page: Page, pool: string[], cards: number) {
  for (let i = 0; i < cards; i++) {
    const options = optionButtons(page);
    await expect(
      options.first(),
      `card ${i + 1} rendered no multiple-choice options`,
    ).toBeVisible();

    const count = await options.count();
    // buildMcOptions returns short rather than padding, and a single option
    // falls back to a typed card, so the legal range is 2..6.
    expect(
      count,
      "a multiple-choice card must offer a real choice",
    ).toBeGreaterThanOrEqual(2);
    expect(count).toBeLessThanOrEqual(6);

    const labels = await optionLabels(page);
    const prompt = (await page.locator(".kq-glyph").first().innerText()).trim();

    // 1. the prompt is not one of its own options
    expect(
      labels,
      `card ${i + 1} offered its own prompt "${prompt}" as an option`,
    ).not.toContain(prompt);

    // 2. no two options render the same text
    expect(
      new Set(labels).size,
      `card ${i + 1} rendered duplicate options: ${JSON.stringify(labels)}`,
    ).toBe(labels.length);

    // Advance by answering correctly.
    const accepted = correctLabelFor(prompt, pool);
    const index = labels.findIndex((l) => accepted.includes(l));
    expect(
      index,
      `card ${i + 1} asked "${prompt}" but offered none of its answers ${JSON.stringify(accepted)} among ${JSON.stringify(labels)}`,
    ).toBeGreaterThanOrEqual(0);

    const card = await page.locator(".kq-glyph").first().elementHandle();
    await options.nth(index).click();
    await expect(answeredPill(page)).toHaveText(`${i + 1} answered`);
    await page.waitForFunction((el) => !el?.isConnected, card);
    await card?.dispose();
  }
}

/** Hiragana with distinct romaji, so a prompt identifies exactly one fact. */
const KANA_POOL = [
  "あ", "い", "う", "え", "お",
  "か", "き", "く", "け", "こ",
  "さ", "す", "せ", "そ",
  "た", "て", "と",
  "な", "に", "ぬ", "ね", "の",
].map((k) => `kana:${k}/reading`);

/** The katakana half, which shares its romaji with the hiragana above and is
 * therefore the set most likely to put two co-correct options on one board. */
const KATAKANA_POOL = [
  "ア", "イ", "ウ", "エ", "オ",
  "カ", "キ", "ク", "ケ", "コ",
  "サ", "ス", "セ", "ソ",
  "タ", "テ", "ト",
  "ナ", "ニ", "ヌ", "ネ", "ノ",
].map((k) => `kana:${k}/reading`);

/**
 * Verb pairs. These are `mcOnly` and pinned to en2jp by `fixedDir`, so they are
 * ALWAYS multiple choice whatever the config says — the one subject where this
 * invariant is not optional, and the one whose two members are near-identical
 * strings (開く / 開ける), which is what makes a duplicate plausible.
 */
const TRANSITIVITY_POOL = [
  "transitivity:開く/開ける/happens",
  "transitivity:開く/開ける/doIt",
  "transitivity:閉まる/閉める/happens",
  "transitivity:閉まる/閉める/doIt",
  "transitivity:始まる/始める/happens",
  "transitivity:始まる/始める/doIt",
  "transitivity:出る/出す/happens",
  "transitivity:出る/出す/doIt",
  "transitivity:入る/入れる/happens",
  "transitivity:入る/入れる/doIt",
];

const cases: Array<{
  name: string;
  pool: string[];
  dir: "jp2en" | "en2jp";
}> = [
  { name: "hiragana", pool: KANA_POOL, dir: "jp2en" },
  { name: "hiragana", pool: KANA_POOL, dir: "en2jp" },
  { name: "katakana", pool: KATAKANA_POOL, dir: "jp2en" },
  { name: "katakana", pool: KATAKANA_POOL, dir: "en2jp" },
  { name: "verb pairs", pool: TRANSITIVITY_POOL, dir: "en2jp" },
];

for (const c of cases) {
  test(`${c.name} multiple choice never gives itself away (${c.dir})`, async ({
    page,
    seed,
  }) => {
    await seed({
      seen: c.pool,
      cfg: { ...STEADY_CFG, ...direction(c.dir), ...style(c.dir, "mc") },
    });
    await startPractice(page);
    await walkCards(page, c.pool, CARDS);
  });
}

import { test as base, expect, type Page } from "@playwright/test";
import { copyFileSync, writeFileSync } from "node:fs";

import { factInfo } from "@/lib/facts";
import type { FactId } from "@/types";
import {
  E2E_HISTORY_FIXTURE,
  E2E_HISTORY_PATH,
  E2E_LISTS_FIXTURE,
  E2E_LISTS_PATH,
} from "./data-dir";

/**
 * Test fixtures for the app.
 *
 * SEEDING STRATEGY (see the report): reaching a known quiz state needs two
 * things seeded, because the app splits them.
 *
 *  1. WHAT can be drilled comes from `history.json` on disk, read through
 *     GET /api/history. `selection.resolve` starts from `knownFacts(history)`,
 *     which is every fact with `history.facts[f].seen > 0`, or a key in
 *     `claims`, or a key in `seen`. `seen` is the cheapest of the three: it is
 *     a plain `Record<FactId, msEpoch>` recording "quiz me", and one entry is
 *     enough to make a fact drillable. So the fixture writes `seen`.
 *
 *  2. HOW it is asked comes from `localStorage["kanaquiz-cfg"]`. The app's
 *     `loadConfig()` spreads the stored object over `defaultConfig()`, so a
 *     partial seed is legal and a test only states the fields it depends on.
 *
 * Seeding rather than clicking from empty is what makes these tests
 * deterministic: the drill picks direction, deck order, MC options and font
 * with `Math.random()`, so the fixture removes the randomness at the source by
 * pinning a single direction, a single answer style and a tiny fact pool.
 *
 * ISOLATION: every path below is under e2e/.tmp, NOT the repo root. The suite
 * seeds and the app writes to a throwaway directory the server was pointed at via
 * SAKU_DATA_DIR (see e2e/helpers/data-dir.ts and playwright.config.ts), so the
 * maintainer's real history.json / lists.json are never opened by a run. Each
 * test still restores the isolated files to the pristine fixture afterwards,
 * because the app writes history itself (a finished quiz POSTs to /api/session),
 * so the reset is unconditional rather than only-if-we-wrote-it — it keeps one
 * spec's leftovers from leaking into the next.
 */

/** The subset of QuizConfig the e2e tests ever pin. Loosely typed on purpose:
 * the app merges over its own defaults, so this is a patch, not a whole shape. */
export type ConfigSeed = Record<string, unknown>;

export type SeedOptions = {
  /** Fact ids to mark as "quiz me", making them the drillable pool. */
  seen?: string[];
  /** Partial QuizConfig merged over the app defaults. */
  cfg?: ConfigSeed;
};

/**
 * Config that removes every source of per-card randomness from a drill.
 *
 * Direction and answer style are pinned because `pickDir()` picks randomly
 * whenever both directions are enabled, and because a card's style is derived
 * per card rather than read straight off the config.
 */
export const STEADY_CFG: ConfigSeed = {
  mode: "drill",
  length: "endless",
  // One attempt per card, so a wrong answer reveals immediately instead of
  // asking again. Every grading test depends on this.
  retries: "none",
  retryN: 0,
  // No countdown, so nothing auto-submits behind the test's back.
  timer: false,
  showAnswer: true,
  // Controls otherwise fade to opacity 0.22 after 2s idle. They stay clickable,
  // but a visibility assertion should not depend on mouse movement.
  fadeControls: false,
  // A single font, so the rendered glyph is stable.
  blurSubmit: false,
};

/** Pin exactly one direction. Both enabled means a random direction per card. */
export function direction(dir: "jp2en" | "en2jp"): ConfigSeed {
  return { dirs: { jp2en: dir === "jp2en", en2jp: dir === "en2jp" } };
}

/** Pin the answer style for a direction. */
export function style(
  dir: "jp2en" | "en2jp",
  s: "typed" | "mc",
): ConfigSeed {
  return dir === "jp2en" ? { styleJp2en: s } : { styleEn2jp: s };
}

/** Narrow the drillable pool to facts whose glyph/meaning/answers match. */
export function textFilter(text: string): ConfigSeed {
  return {
    selection: {
      subjects: [],
      list: null,
      states: [],
      text,
      session: null,
    },
  };
}

function historyWith(seen: string[]): string {
  const now = Date.now();
  const seenRecord: Record<string, number> = {};
  for (const f of seen) seenRecord[f] = now;
  return JSON.stringify({ sessions: [], facts: {}, seen: seenRecord }, null, 1);
}

/** Put the ISOLATED history and lists back to their pristine fixtures. Only ever
 * touches e2e/.tmp — the repo-root files are not in play. Lists are reset too, so
 * a spec that files something into a list cannot bleed into the next one. */
export function restoreHistory(): void {
  copyFileSync(E2E_HISTORY_FIXTURE, E2E_HISTORY_PATH);
  copyFileSync(E2E_LISTS_FIXTURE, E2E_LISTS_PATH);
}

export const test = base.extend<{
  /** Seed disk + localStorage, then navigate. Call before the first goto. */
  seed: (options: SeedOptions) => Promise<void>;
}>({
  seed: async ({ page }, use) => {
    await use(async ({ seen = [], cfg = {} }: SeedOptions) => {
      writeFileSync(E2E_HISTORY_PATH, historyWith(seen));
      // addInitScript runs before any page script on every navigation, so the
      // config is in place before QuizConfigProvider's hydration effect reads
      // it. Setting it after a goto would race that effect.
      await page.addInitScript((value: string) => {
        window.localStorage.setItem("kanaquiz-cfg", value);
      }, JSON.stringify(cfg));
    });
  },

  page: async ({ page }, use) => {
    await use(page);
    restoreHistory();
  },
});

export { expect };
export type { Page };

/**
 * Wait for the drill to have drawn a card.
 *
 * The drill only paints once QuizConfigProvider and the session provider have
 * both hydrated from localStorage, so "the glyph exists" is the honest signal
 * that setup finished. `.kq-glyph` is the halo's glyph span.
 */
export async function drillReady(page: Page) {
  const glyph = page.locator(".kq-glyph").first();
  await expect(glyph).toBeVisible();
  return glyph;
}

/** The drill's typed answer box, whichever direction produced it. */
export function answerBox(page: Page) {
  return page.locator(
    // The two placeholders lib/drill-guidance.ts hands out — one per kind of
    // answer. "Type answer" was the single old wording, replaced by "Type
    // English" when the box started saying which language it wants.
    'input[placeholder="Type romaji, Enter to submit"], input[placeholder="Type English, Enter to submit"]',
  );
}

/** The multiple-choice option buttons for the current card. */
export function optionButtons(page: Page) {
  return page.locator("button.min-w-\\[74px\\]");
}

/**
 * The drill HUD's two grading pills.
 *
 * These are the only PERMANENT, textual record of how an answer was graded —
 * the halo's colour is inline style and gone in 650ms. `answered` counts every
 * resolved card, right or wrong; `requeued` counts only cards that ran out of
 * retries, which with `retries: "none"` means exactly "was wrong".
 */
export function answeredPill(page: Page) {
  return page.getByText(ANSWERED_RE);
}

/**
 * The endless pill's text: the count, and then the fact that there is no end.
 *
 * The bare "3 answered" this replaced was a count with a missing second half —
 * it looked like an x-of-y whose y had gone astray rather than a quiz that does
 * not have one. Kept here so the tests assert the copy in one place.
 */
export function answeredText(n: number): string {
  return `${n} answered · endless`;
}

const ANSWERED_RE = /^\d+ answered · endless$/;

/**
 * The resolved-count pill, in EITHER of the two shapes the drill uses: an
 * endless run says "3 answered · endless", a limited one says "3 / 5". Tests that
 * only care how many cards are done should use this rather than assuming a
 * shape, because the shape is a config choice.
 */
export function progressPill(page: Page) {
  return page.getByText(/^(\d+ answered · endless|\d+ \/ \d+)$/);
}

export function requeuedPill(page: Page) {
  return page.getByText(/^\d+ re-queued$/);
}

/**
 * The wrong-answer reveal paragraph, or an empty locator when nothing is
 * revealed. The app renders the reveal in the one `min-h-[38px]` paragraph
 * under the input; the expected answer is its `.text-danger` span.
 */
export function reveal(page: Page) {
  const box = page.locator("p.min-h-\\[38px\\]");
  return {
    box,
    /** The span holding what the answer SHOULD have been. */
    answer: box.locator("span.text-danger"),
    /** The span re-showing the prompt glyph that was asked. */
    prompt: box.locator("span.text-lg").first(),
  };
}

/**
 * Answer the typed card currently on screen correctly, then wait for the next.
 *
 * `pool` is the seeded fact list; the answer is looked up in the app's own
 * registry, which is legitimate here because these callers are testing FLOW,
 * not grading. The grading specs hardcode their expected answers instead, so
 * that they cannot quietly agree with a broken registry.
 *
 * The wait is on the old glyph node detaching. The drill keys the halo on
 * `${rt.asked}-${q.tries}`, and a CORRECT answer never bumps `tries`, so a
 * remount can only mean the next question was drawn. That makes this exact
 * rather than a sleep, which matters because the app auto-advances a CORRECT
 * answer after 650ms. Nothing else auto-advances any more: a miss waits for
 * Enter or the Continue button in every mode, board cards included.
 */
export async function answerTypedCorrectly(
  page: Page,
  pool: readonly string[],
  expectedTotal: number,
) {
  const glyphLocator = page.locator(".kq-glyph").first();
  const glyphNode = await glyphLocator.elementHandle();
  const glyph = (await glyphLocator.innerText()).trim();

  const fact = pool.find((f) => factInfo(f as FactId)?.glyph === glyph);
  const answer = fact ? factInfo(fact as FactId)?.answers[0] : undefined;
  if (!answer) throw new Error(`no seeded fact renders the glyph "${glyph}"`);

  const box = answerBox(page);
  await expect(box).toBeVisible();
  await box.fill(answer);
  await box.press("Enter");

  // Matches both pill shapes: "3 answered · endless" and "3 / 5".
  await expect(progressPill(page)).toHaveText(
    new RegExp(`^${expectedTotal} (answered · endless|/ \\d+)$`),
  );
  await page.waitForFunction((el) => !el?.isConnected, glyphNode);
  await glyphNode?.dispose();
}

/** Start a drill from the Practice page with the seeded config already in place. */
export async function startPractice(page: Page) {
  await page.goto("/practice");
  const start = page.getByRole("button", { name: "Start", exact: true });
  await expect(start).toBeEnabled();
  await start.click();
  await page.waitForURL("**/quiz");
  return drillReady(page);
}

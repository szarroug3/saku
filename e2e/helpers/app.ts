import { test as base, expect, type Locator, type Page } from "@playwright/test";

import { defaultAsk } from "@/lib/ask-config";
import { factInfo } from "@/lib/facts";
import type { AskConfig, FactId } from "@/types";

/**
 * Test fixtures for the app.
 *
 * SEEDING STRATEGY: the suite runs SIGNED OUT, the app's default when there is
 * no Supabase session (see playwright.config.ts — auth is disabled independently
 * of the public content connection). A signed-out learner's progress lives in THIS browser's localStorage,
 * not in a server file, so both things a known quiz state needs are seeded there
 * with `addInitScript`:
 *
 *  1. WHAT can be drilled comes from `localStorage["saku-local-history"]`, the
 *     signed-out history the HistoryProvider reads (see store/local-progress.ts;
 *     GET /api/history answers 401 with no account, and the client falls back to
 *     this key). `selection.resolve` starts from `knownFacts(history)`, which is
 *     every fact with `history.facts[f].seen > 0`, or a key in `claims`, or a key
 *     in `seen`. `seen` is the cheapest of the three: a plain
 *     `Record<FactId, msEpoch>` recording "quiz me", and one entry is enough to
 *     make a fact drillable. So the fixture writes `seen`.
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
 * ISOLATION is free: Playwright gives every test its own browser context with a
 * fresh, empty localStorage, so what one spec seeds or the app writes (a finished
 * quiz that fell back to a local save) cannot leak into the next. There is no
 * shared file to restore.
 */

/** The subset of QuizConfig the e2e tests ever pin. Loosely typed on purpose:
 * the app merges over its own defaults, so this is a patch, not a whole shape. */
export type ConfigSeed = Record<string, unknown>;

export type SeedOptions = {
  /** Fact ids to mark as "quiz me", making them the drillable pool. */
  seen?: string[];
  /** Fact ids to mark CLAIMED ("I already know this"). */
  claims?: string[];
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
export function style(dir: "jp2en" | "en2jp", s: "typed" | "mc"): ConfigSeed {
  return dir === "jp2en" ? { styleJp2en: s } : { styleEn2jp: s };
}

/** The signed-out history blob for a set of "quiz me" facts, shaped like the
 * HistoryFile the client reads back from `saku-local-history`. */
function historyWith(seen: string[], claims: string[]): string {
  const now = Date.now();
  const seenRecord: Record<string, number> = {};
  for (const f of seen) seenRecord[f] = now;
  const claimsRecord: Record<string, number> = {};
  for (const f of claims) claimsRecord[f] = now;
  return JSON.stringify({
    sessions: [],
    facts: {},
    seen: seenRecord,
    claims: claimsRecord,
  });
}

/**
 * Translate a ConfigSeed into the stored `askOverride` the app's normalizeConfig
 * honors (see the TEST SEAM there). The simplified config regenerates `ask` from
 * a single audioPrompts boolean, so a spec can no longer pin a direction / style
 * through config alone; this rebuilds the intended AskConfig from either an
 * explicit `ask` (the ask() helper) or the deprecated direction()/style() fields
 * and stashes it as `askOverride`, which survives the load. Call sites keep using
 * the same seed helpers.
 *
 * Direction is inferred from which SOURCE is enabled: `japanese` ⇒ jp→en,
 * `english` ⇒ en→jp. Style is the source's `answers` (typed | mc). Response
 * (definition | romaji) is left to the FACT, which enabledFormsFor filters by.
 */
export function withAskOverride(cfg: ConfigSeed): ConfigSeed {
  if (cfg.askOverride) return cfg;
  const explicit = cfg.ask;
  if (explicit && typeof explicit === "object") {
    return { ...cfg, askOverride: explicit };
  }
  const dirs = cfg.dirs as { jp2en: boolean; en2jp: boolean } | undefined;
  const sJp = cfg.styleJp2en as "typed" | "mc" | undefined;
  const sEn = cfg.styleEn2jp as "typed" | "mc" | undefined;
  if (!dirs && !sJp && !sEn) return cfg;
  const base = defaultAsk();
  const jpOn = dirs ? dirs.jp2en : true;
  const enOn = dirs ? dirs.en2jp : true;
  const askOverride: AskConfig = {
    japanese: {
      ...base.japanese,
      responses: jpOn ? base.japanese.responses : [],
      answers: jpOn ? [sJp ?? "typed"] : [],
    },
    sentence: base.sentence,
    english: { answers: enOn ? [sEn ?? "typed"] : [] },
  };
  return { ...cfg, askOverride };
}

export const test = base.extend<{
  /** Seed the signed-out localStorage (history + config), then navigate. Call
   * before the first goto. */
  seed: (options: SeedOptions) => Promise<void>;
}>({
  seed: async ({ page }, use) => {
    await use(async ({ seen = [], claims = [], cfg = {} }: SeedOptions) => {
      // addInitScript runs before any page script on every navigation, so both
      // keys are in place before the HistoryProvider reads the local history and
      // QuizConfigProvider's hydration effect reads the config. Setting them
      // after a goto would race those.
      //
      // History is seeded ONCE, guarded on absence: a reload re-runs this script,
      // and the app writes finished rounds straight into `saku-local-history`
      // (the signed-out 401→local fallback), so re-seeding unconditionally would
      // wipe progress the test just made. The config is pinned every time — it is
      // input the test controls, not state the app accrues.
      await page.addInitScript(
        (v: { history: string; cfg: string }) => {
          if (window.localStorage.getItem("saku-local-history") === null) {
            window.localStorage.setItem("saku-local-history", v.history);
          }
          window.localStorage.setItem("kanaquiz-cfg", v.cfg);
        },
        {
          history: historyWith(seen, claims),
          cfg: JSON.stringify(withAskOverride(cfg)),
        },
      );
    });
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

/**
 * Poll-once-with-a-short-window visibility check, for "click Next until X
 * shows up" loops.
 *
 * A bare `locator.isVisible()` is a single synchronous DOM snapshot — no
 * retry. Right after a "Next" click that swaps a step's content via React
 * state (no navigation, so nothing for Playwright's own auto-waiting to hook
 * into), the new content can still be a frame or two from painting, so an
 * immediate `isVisible()` intermittently reads the OLD (or not-yet-updated)
 * DOM as "not there" and fires another click — skipping straight past the
 * step being looked for. `waitFor` polls, so it rides out that gap instead of
 * racing it, while still resolving `false` quickly (default 750ms — well
 * under a step render, comfortably under the loops' own per-iteration budget)
 * when the target genuinely isn't on this step.
 */
export async function isVisibleSoon(locator: Locator, timeout = 750): Promise<boolean> {
  try {
    await locator.waitFor({ state: "visible", timeout });
    return true;
  } catch {
    return false;
  }
}

/** The drill's typed answer box, whichever direction produced it. */
export function answerBox(page: Page) {
  return page.locator(
    // The two placeholders lib/drill-guidance.ts hands out — one per kind of
    // answer. "Type answer" was the single old wording, replaced by "Type
    // English" when the box started saying which language it wants.
    'input[placeholder="Type romaji, Enter to submit"], input[placeholder="Type kana, Enter to submit"], input[placeholder="Type English, Enter to submit"]',
  );
}

/** The multiple-choice option buttons for the current card. */
export function optionButtons(page: Page) {
  // The MC option buttons in the drill's 3-col board (drill-screen.tsx). The
  // board moved to a uniform grid in b9dad93, dropping the old `min-w-[74px]`
  // row styling for `min-h-[60px]` cells; this selector tracks that shape.
  return page.locator("button.min-h-\\[60px\\]");
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

// SAK-145 round 3: a single-subject quiz prefixes the pill with its track
// name ("Vowels · 3 / 5"), the same "Track · position" shape the teach-phase
// header uses — omitted (bare position, as before) when the fact pool is
// mixed-subject. The prefix is optional here for that reason, not because
// its presence is untested: which shape a given seeded pool renders is a
// content fact, not something these regexes should have to track.
const TRACK_PREFIX = "(?:[^·]+ · )?";
const ANSWERED_RE = new RegExp(`^${TRACK_PREFIX}\\d+ answered · endless$`);

/**
 * The resolved-count pill, in EITHER of the two shapes the drill uses: an
 * endless run says "3 answered · endless", a limited one says "3 / 5". Tests that
 * only care how many cards are done should use this rather than assuming a
 * shape, because the shape is a config choice.
 */
export function progressPill(page: Page) {
  return page.getByText(
    new RegExp(`^${TRACK_PREFIX}(\\d+ answered · endless|\\d+ \\/ \\d+)$`),
  );
}

/**
 * `answeredText`, tolerant of the optional track prefix above — for
 * `toHaveText` assertions, which (given a string) require an exact match.
 * `answeredText`'s plain string is still right for `getByText`, a substring
 * match by default.
 */
export function answeredTextRe(n: number): RegExp {
  return new RegExp(`^${TRACK_PREFIX}${n} answered · endless$`);
}

/** `${n} / ${total}`, tolerant of the optional track prefix — see `answeredTextRe`. */
export function progressText(n: number, total: number): RegExp {
  return new RegExp(`^${TRACK_PREFIX}${n} \\/ ${total}$`);
}

/**
 * The teach header's position pill — "4 of 10", optionally prefixed by its
 * track the same way a quiz's progress pill is (SAK-145 round 1 predates
 * round 3's quiz prefix, but the shape — and the reason a test should not
 * hardcode it away — is the same).
 */
export function teachPosition(page: Page) {
  return page.getByText(new RegExp(`^${TRACK_PREFIX}\\d+ of \\d+$`));
}

/** `${n} of ${total}`, tolerant of the optional track prefix — see `progressText`. */
export function teachPositionText(n: number, total: number): RegExp {
  return new RegExp(`^${TRACK_PREFIX}${n} of ${total}$`);
}

export function requeuedPill(page: Page) {
  return page.getByText(/^\d+ re-queued$/);
}

/**
 * The wrong-answer reveal, or an empty locator when nothing is revealed. The
 * app renders the reveal sentence in the one `min-h-[38px]` paragraph under
 * the input, with the expected answer in its `.text-danger` span — EXCEPT for
 * a card whose hint is a derivation (SAK-194 changes-requested,
 * showsRevealSentence in lib/drill-reveal.ts): that paragraph is suppressed
 * entirely there, because the derivation's own "X becomes Y" line already
 * says what the sentence would, and the equations (HintBody, hint-content.tsx)
 * render straight into the reveal band in its place. `box` matches whichever
 * one is actually on screen — the sentence paragraph when it renders, or the
 * fixed reveal band itself when it doesn't — via a `:not(:has())` guard
 * rather than an OR of two locators, since both a sentence card and a
 * derivation card always have SOME `.kq-band` on screen (the drill also has a
 * sticky top HUD band with that same class) and only one of the two selectors
 * should ever be live at once.
 *
 * SAK-190 dropped the restated-prompt-glyph span this used to expose as
 * `.prompt` — the reveal sentence no longer re-states what was asked (the
 * question is still visible on the card above), so there is nothing left for
 * a locator to target there.
 */
export function reveal(page: Page) {
  const sentence = "p.min-h-\\[38px\\]";
  const box = page.locator(
    `${sentence}, div.kq-band.fixed:not(:has(${sentence}))`,
  );
  return {
    box,
    /** The span holding what the answer SHOULD have been. Only present on
     * the sentence-shaped reveal — a derivation-hint card has no
     * `.text-danger` span, its own accented span (`.text-accent`) is the
     * equivalent there. */
    answer: box.locator("span.text-danger"),
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

  // Matches both pill shapes: "3 answered · endless" and "3 / 5". A generous
  // timeout, not the suite default: this fires on every answer of every
  // multi-round session test, so it is the one assertion most exposed to a
  // dev-mode Next.js server's request queue backing up under concurrent
  // worker load — a real slowdown, not a stuck state, since it always
  // resolves given enough time rather than timing out on a genuinely wrong
  // value.
  await expect(progressPill(page)).toHaveText(
    new RegExp(`^${TRACK_PREFIX}${expectedTotal} (answered · endless|/ \\d+)$`),
    { timeout: 30_000 },
  );
  await page.waitForFunction((el) => !el?.isConnected, glyphNode, { timeout: 30_000 });
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

/**
 * Walk the day-one curriculum lesson (the five vowels) from /learn to a live
 * drill, and stop on the first quiz card.
 *
 * The teach walk is the same one the end-to-end lesson test spells out card by
 * card; here it is compressed to "click Next until only Quiz me is left", so a
 * test that only cares about the round AFTER the drill doesn't re-assert the
 * teach steps. The caller must have seeded an EMPTY history (so the curriculum
 * offers hiragana group 1) plus a jp2en typed, limited-coverage config before
 * calling — see the CFG the lesson specs share.
 */
export async function startVowelLessonDrill(page: Page): Promise<void> {
  await page.goto("/learn");
  // From empty history the kana track's card-0 (SAK-28) shows in place of the
  // ordinary lesson card, a one-time teaser. Its "Start track" button only
  // dismisses the teaser, revealing the normal lesson card in its place; the
  // real "Start" button on THAT card is what leads to /session.
  await page.getByRole("button", { name: "Start track", exact: true }).click();
  await page.getByRole("button", { name: "Start", exact: true }).click();
  await page.waitForURL("**/session");
  // The track intro and each teach card carry a "Next"; the last card drops it
  // for "Quiz me". Click through them all — the guard is only there so a copy
  // change that leaves Next on screen can't spin this forever.
  for (let guard = 0; guard < 20; guard++) {
    const next = page.getByRole("button", { name: "Next", exact: true });
    if ((await next.count()) === 0) break;
    await next.click();
  }
  await page.getByRole("button", { name: "Quiz me", exact: true }).click();
  await page.waitForURL("**/quiz");
  await drillReady(page);
}

/**
 * Answer the drill card on screen, correctly or wrongly, and advance.
 *
 * The correct path reuses answerTypedCorrectly's trick — look the answer up in
 * the app's registry, submit, and wait on the old glyph node detaching, which
 * for a right answer can only mean the next card was drawn (a correct answer
 * never bumps `tries`, so the halo only remounts on a fresh question).
 *
 * The WRONG path is the miss-then-resolve flow the round-state specs need. With
 * `retries: "none"` a wrong answer is out of retries at once: the showing
 * resolves as missed and the card waits behind a Continue button (nothing
 * auto-advances a miss any more). Clicking Continue is what moves the run on.
 * The typed miss text is deliberately non-romaji ("xyz" by default) so the drill
 * records it verbatim as the "said" value and never mistakes it for a real
 * answer or a confusion.
 *
 * `last` says this is the final card of a coverage run: resolving it finishes
 * the quiz and navigates, so we wait for `finishUrl` (the session loop for a
 * lesson, /results for a plain practice run) instead of a next card.
 */
export async function answerDrillCard(
  page: Page,
  pool: readonly string[],
  opts: {
    wrong?: boolean;
    wrongText?: string;
    last?: boolean;
    finishUrl?: string;
  } = {},
): Promise<void> {
  const {
    wrong = false,
    wrongText = "xyz",
    last = false,
    finishUrl = "**/session",
  } = opts;

  const glyphLocator = page.locator(".kq-glyph").first();
  await expect(glyphLocator).toBeVisible();
  const glyphNode = await glyphLocator.elementHandle();
  const glyph = (await glyphLocator.innerText()).trim();

  const box = answerBox(page);
  await expect(box).toBeVisible();

  if (wrong) {
    await box.fill(wrongText);
    await box.press("Enter");
    const cont = page.getByRole("button", { name: "Continue", exact: true });
    await expect(cont).toBeVisible();
    if (last) {
      await Promise.all([page.waitForURL(finishUrl), cont.click()]);
    } else {
      await cont.click();
      await page.waitForFunction((el) => !el?.isConnected, glyphNode);
    }
  } else {
    const fact = pool.find((f) => factInfo(f as FactId)?.glyph === glyph);
    const answer = fact ? factInfo(fact as FactId)?.answers[0] : undefined;
    if (!answer) throw new Error(`no seeded fact renders the glyph "${glyph}"`);
    await box.fill(answer);
    await box.press("Enter");
    if (last) {
      await page.waitForURL(finishUrl);
    } else {
      await page.waitForFunction((el) => !el?.isConnected, glyphNode);
    }
  }
  await glyphNode?.dispose();
}

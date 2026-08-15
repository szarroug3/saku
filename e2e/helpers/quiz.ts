import { expect, type Page } from "@playwright/test";

import { withAskOverride, type ConfigSeed } from "./app";

/**
 * QUIZ-surface seeding + locators, kept apart from helpers/app.ts so the two
 * e2e agents working this suite in parallel never touch the same file.
 *
 * WHY A SECOND SEEDER. helpers/app.ts's `seed` fixture writes `seen` + `cfg`,
 * which is everything a grading test needs. The quiz-surface tests need two more
 * levers app.ts deliberately doesn't expose:
 *
 *   - `claims` — the "I already know this" record. The live-standing test seeds a
 *     CLAIM (so the Library reads "claimed") and then misses the card, and there
 *     is no claim without this key.
 *   - `facts` — a pre-baked aggregate. The kanji-in-word reading card is only
 *     ASKABLE once a MULTI-PART word attesting the reading is KNOWN (see
 *     word-unlock.ts). Seeding that word's meaning as a real aggregate makes it
 *     known — and pairing it with a `subjects: ["kanji"]` selection keeps the
 *     word itself OUT of the drill pool, so the reading card is the only card
 *     that can be drawn. That is the whole trick these tests lean on.
 *
 * Everything else mirrors app.ts exactly: signed-out, localStorage, addInitScript
 * before the first navigation, history seeded once (guarded on absence) so a
 * finished round the app writes back is not wiped, config pinned every time.
 */

export type QuizSeed = {
  /** Facts to mark "quiz me" (drillable). */
  seen?: string[];
  /** Facts to mark claimed ("I already know this"). Drillable AND untested. */
  claims?: string[];
  /** Facts to bake a KNOWN aggregate for — used to satisfy a reading card's
   * anchor without also drilling the anchor word. Value is the fact id. */
  known?: string[];
  /** Partial QuizConfig merged over the app defaults. */
  cfg?: ConfigSeed;
};

/** A history blob with seen / claims / a synthetic aggregate, shaped like the
 * HistoryFile the signed-out client reads from `saku-local-history`. */
function historyBlob(seed: QuizSeed): string {
  const now = Date.now();
  const seenRecord: Record<string, number> = {};
  for (const f of seed.seen ?? []) seenRecord[f] = now;
  const claimsRecord: Record<string, number> = {};
  for (const f of seed.claims ?? []) claimsRecord[f] = now;
  // A real aggregate: stability > 0 and lastTested > 0 read as "known" through
  // effectiveState (see claims.ts / word-unlock.ts wordKnown), which is all the
  // reading-card anchor needs. The counts keep accuracy math well-defined.
  const facts: Record<string, unknown> = {};
  for (const f of seed.known ?? []) {
    facts[f] = {
      seen: 4,
      correct: 4,
      firstTry: 4,
      lastTested: now,
      stability: 30,
    };
  }
  return JSON.stringify({
    sessions: [],
    facts,
    seen: seenRecord,
    claims: claimsRecord,
  });
}

/**
 * Seed the signed-out localStorage (history + config), then let the test
 * navigate. Call BEFORE the first goto — addInitScript runs before any page
 * script on every navigation, so both keys are in place before the providers
 * hydrate. History is guarded on absence (a reload re-runs this); config is
 * pinned every time, since it is input the test controls.
 */
export async function seedQuiz(page: Page, seed: QuizSeed = {}): Promise<void> {
  await page.addInitScript(
    (v: { history: string; cfg: string }) => {
      if (window.localStorage.getItem("saku-local-history") === null) {
        window.localStorage.setItem("saku-local-history", v.history);
      }
      window.localStorage.setItem("kanaquiz-cfg", v.cfg);
    },
    { history: historyBlob(seed), cfg: JSON.stringify(withAskOverride(seed.cfg ?? {})) },
  );
}

// ---------------------------------------------------------------------------
// "How to ask" (AskConfig) builders — task 30's source-based config.
// ---------------------------------------------------------------------------

type PromptFormat = "text" | "audio";
type ResponseKind = "definition" | "romaji";
type AnswerStyle = "typed" | "mc";

/** A whole `ask` config. The three sources, spelled out — a test states exactly
 * what it turns on, because the whole point of the audio/coverage tests is which
 * forms are enabled. Sentence and English default to nothing so a lone Japanese
 * source is the only thing producing cards. */
export function ask(opts: {
  jpPrompts?: PromptFormat[];
  jpResponses?: ResponseKind[];
  jpAnswers?: AnswerStyle[];
  enAnswers?: AnswerStyle[];
}): ConfigSeed {
  return {
    ask: {
      japanese: {
        prompts: opts.jpPrompts ?? ["text"],
        responses: opts.jpResponses ?? ["definition", "romaji"],
        answers: opts.jpAnswers ?? ["typed"],
      },
      sentence: { prompts: [], responses: [], answers: [] },
      english: { answers: opts.enAnswers ?? [] },
    },
  };
}

/** A selection pinned to one subject, so a known anchor word of another subject
 * stays out of the drill pool. Mirrors selection.ts's own empty shape. */
export function subjectOnly(subject: "kanji" | "word" | "kana"): ConfigSeed {
  return {
    selection: {
      subjects: [subject],
      list: null,
      states: [],
      text: "",
      session: null,
    },
  };
}

// ---------------------------------------------------------------------------
// Drill locators shared across the quiz specs.
// ---------------------------------------------------------------------------

/** The white instruction line under the halo ("Type what this kanji means."). */
export function instruction(page: Page) {
  return page.locator("p.font-medium.text-text").first();
}

/** The Hint button, before it is pressed. */
export function hintButton(page: Page) {
  return page.getByRole("button", { name: "Hint", exact: true });
}

/** The listening card's centre speaker — present only while the audio prompt is
 * standing in for the glyph. */
export function listenSpeaker(page: Page) {
  return page.getByRole("button", { name: "Play the word again" });
}

/** The Skip control ("ask this again later"). */
export function skipButton(page: Page) {
  return page.getByRole("button", { name: "Skip", exact: true });
}

/** Start a drill from the Practice page with the seeded config in place. Mirrors
 * app.ts's startPractice, duplicated here so this file stands alone. */
export async function startQuizDrill(page: Page) {
  await page.goto("/practice");
  const start = page.getByRole("button", { name: "Start", exact: true });
  await expect(start).toBeEnabled();
  await start.click();
  await page.waitForURL("**/quiz");
  const glyph = page.locator(".kq-glyph").first();
  await expect(glyph).toBeVisible();
  return glyph;
}

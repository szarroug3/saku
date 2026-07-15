// Quiz engine — pure TypeScript, no React. Ports the deck/answer/stats logic
// from legacy/app.html. Question types are pluggable: the v2 roadmap
// (write-a-word, listen) and v3 (stroke order, draw) implement QuestionType
// as pure data + logic additions.

import type {
  CharSessionDetail,
  Direction,
  QuizConfig,
  SessionStats,
} from "@/types";

const TODO = () => new Error("TODO(agent:engine): not implemented yet");

// ---------- question type extension point ----------

/** A pluggable question kind. Today: character recall (jp2en / en2jp). */
export interface QuestionType {
  id: string;
  /** What to display as the prompt for `char` in `dir`. */
  prompt(char: string, dir: Direction): string;
  /** Whether `given` answers `char` correctly in `dir`. */
  check(char: string, dir: Direction, given: string): boolean;
}

/** The one question type that exists today. */
export const charRecall: QuestionType = {
  id: "char-recall",
  prompt() {
    throw TODO();
  },
  check() {
    throw TODO();
  },
};

// ---------- deck ----------

/** Fisher–Yates, returns the same (mutated) array. */
export function shuffle<T>(arr: T[]): T[] {
  throw TODO();
}

/**
 * Build the starting deck for drill/pairs from the selected chars,
 * honoring length=limited + limType=count (repeat-fill then cap).
 */
export function buildDeck(chars: string[], cfg: QuizConfig): string[] {
  throw TODO();
}

/** Random requeue gap: BEHAVIOR.requeueMin–requeueMax inclusive. */
export function requeueGap(): number {
  throw TODO();
}

/** Random direction from the enabled ones in cfg.dirs. */
export function pickDir(cfg: QuizConfig): Direction {
  throw TODO();
}

// ---------- answers ----------

/**
 * Greedy romaji→kana for the live preview: longest match (3,2,1) via
 * ROMAJI_TO_KANA, っ for doubled consonants (kstpgzdbc), "·" for no match.
 */
export function romajiToKana(input: string): string {
  throw TODO();
}

/** Case/whitespace-forgiving check of a typed romaji answer for `char`. */
export function checkTyped(char: string, given: string): boolean {
  throw TODO();
}

/**
 * The char (same script as `char`) whose romaji matches a wrong typed answer,
 * for confusion tracking — or null.
 */
export function confusedWith(char: string, given: string): string | null {
  throw TODO();
}

/**
 * Multiple-choice options (chars) for `char`: correct + lookalikes first +
 * same-script fill, shuffled, BEHAVIOR.mcOptions total.
 */
export function buildMcOptions(char: string): string[] {
  throw TODO();
}

/** Retries allowed under cfg: none → 0, lim → retryN, unl → Infinity. */
export function retriesAllowed(cfg: QuizConfig): number {
  throw TODO();
}

// ---------- stats ----------

/** Fresh per-char stat record (legacy statFor default shape). */
export function newCharStat(): CharSessionDetail {
  throw TODO();
}

export interface ResultsSummary {
  chars: string[];
  total: number;
  forg: number;
  strict: number;
  slow: number;
}

/** Totals for the results screen (forgiving vs strict + slow count). */
export function computeResults(stats: SessionStats): ResultsSummary {
  throw TODO();
}

/** Chars counting as "missed" under the given view. */
export function missedChars(
  stats: SessionStats,
  view: "forg" | "strict",
): string[] {
  throw TODO();
}

/** Symmetric confusion pairs: "a·b" (sorted) → count, sorted desc. */
export function confusionPairs(
  stats: SessionStats,
): Array<[string, number]> {
  throw TODO();
}

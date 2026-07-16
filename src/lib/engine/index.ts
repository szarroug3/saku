// Quiz engine — pure TypeScript, no React. Ports the deck/answer/stats logic
// from legacy/app.html. Question types are pluggable: the v2 roadmap
// (write-a-word, listen) and v3 (stroke order, draw) implement QuestionType
// as pure data + logic additions.

import { CHAR_INDEX, LOOK_GROUP } from "@/data/characters";
import { BEHAVIOR } from "@/lib/config";
import type {
  CharSessionDetail,
  Direction,
  QuizConfig,
  SessionStats,
} from "@/types";

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
  prompt(char, dir) {
    return dir === "jp2en" ? char : CHAR_INDEX[char].r[0];
  },
  check(char, dir, given) {
    return dir === "jp2en" ? checkTyped(char, given) : given.trim() === char;
  },
};

// ---------- deck ----------

/** Fisher–Yates, returns the same (mutated) array. */
export function shuffle<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/**
 * Build the starting deck for drill/pairs from the selected chars,
 * honoring length=limited + limType=count (repeat-fill then cap).
 */
export function buildDeck(chars: string[], cfg: QuizConfig): string[] {
  let deck = shuffle(chars.slice());
  if (
    cfg.length === "limited" &&
    cfg.limType === "count" &&
    cfg.mode === "drill"
  ) {
    while (chars.length > 0 && deck.length < cfg.limCount) {
      deck = deck.concat(shuffle(chars.slice()));
    }
    deck = deck.slice(0, cfg.limCount);
  }
  return deck;
}

/** Random requeue gap: BEHAVIOR.requeueMin–requeueMax inclusive. */
export function requeueGap(): number {
  return (
    BEHAVIOR.requeueMin +
    Math.floor(Math.random() * (BEHAVIOR.requeueMax - BEHAVIOR.requeueMin + 1))
  );
}

/** Random direction from the enabled ones in cfg.dirs. */
export function pickDir(cfg: QuizConfig): Direction {
  const d: Direction[] = [];
  if (cfg.dirs.jp2en) d.push("jp2en");
  if (cfg.dirs.en2jp) d.push("en2jp");
  return d[Math.floor(Math.random() * d.length)];
}

// ---------- answers ----------

/** Case/whitespace-forgiving check of a typed romaji answer for `char`. */
export function checkTyped(char: string, given: string): boolean {
  return CHAR_INDEX[char].r.includes(given.trim().toLowerCase());
}

/**
 * The char (same script as `char`) whose romaji matches a wrong typed answer,
 * for confusion tracking — or null.
 */
export function confusedWith(char: string, given: string): string | null {
  const info = CHAR_INDEX[char];
  const g = given.trim().toLowerCase();
  const match = Object.keys(CHAR_INDEX).find(
    (x) =>
      x !== char &&
      CHAR_INDEX[x].r.includes(g) &&
      CHAR_INDEX[x].set === info.set,
  );
  return match ?? null;
}

/**
 * Multiple-choice options (chars) for `char`: correct + lookalikes first +
 * same-script fill, shuffled, BEHAVIOR.mcOptions total.
 */
export function buildMcOptions(char: string): string[] {
  const info = CHAR_INDEX[char];
  const pool = Object.keys(CHAR_INDEX).filter((x) => x !== char);
  const looks = (LOOK_GROUP[char] ?? []).filter((x) => CHAR_INDEX[x]);
  const opts = [char];
  shuffle(looks).forEach((x) => {
    if (opts.length < BEHAVIOR.mcOptions && !opts.includes(x)) opts.push(x);
  });
  const sameSet = shuffle(pool.filter((x) => CHAR_INDEX[x].set === info.set));
  sameSet.forEach((x) => {
    if (opts.length < BEHAVIOR.mcOptions && !opts.includes(x)) opts.push(x);
  });
  return shuffle(opts);
}

/** Retries allowed under cfg: none → 0, lim → retryN, unl → Infinity. */
export function retriesAllowed(cfg: QuizConfig): number {
  return cfg.retries === "unl" ? Infinity : cfg.retries === "none" ? 0 : cfg.retryN;
}

// ---------- stats ----------

/** Fresh per-char stat record (legacy statFor default shape). */
export function newCharStat(): CharSessionDetail {
  return {
    seen: 0,
    misses: 0,
    everCorrect: false,
    firstTryCorrect: null,
    slow: 0,
    confused: {},
  };
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
  const chars = Object.keys(stats);
  const total = chars.length;
  const forg = chars.filter((c) => stats[c].everCorrect).length;
  const strict = chars.filter((c) => stats[c].firstTryCorrect === true).length;
  const slow = chars.reduce((n, c) => n + stats[c].slow, 0);
  return { chars, total, forg, strict, slow };
}

/** Chars counting as "missed" under the given view, most misses first. */
export function missedChars(
  stats: SessionStats,
  view: "forg" | "strict",
): string[] {
  return Object.keys(stats)
    .filter((c) =>
      view === "forg"
        ? stats[c].misses > 0 || !stats[c].everCorrect
        : stats[c].firstTryCorrect !== true,
    )
    .sort((a, b) => stats[b].misses - stats[a].misses);
}

/** Symmetric confusion pairs: "a·b" (sorted) → count, sorted desc. */
export function confusionPairs(
  stats: SessionStats,
): Array<[string, number]> {
  const pairs: Record<string, number> = {};
  for (const c of Object.keys(stats)) {
    for (const [x, n] of Object.entries(stats[c].confused)) {
      const key = [c, x].sort().join("·");
      pairs[key] = (pairs[key] ?? 0) + n;
    }
  }
  return Object.entries(pairs).sort((a, b) => b[1] - a[1]);
}

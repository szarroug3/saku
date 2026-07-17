// Quiz engine — pure TypeScript, no React. Ports the deck/answer/stats logic
// from legacy/app.html. Question types are pluggable: the v2 roadmap
// (write-a-word, listen) and v3 (stroke order, draw) implement QuestionType
// as pure data + logic additions.

import { BEHAVIOR } from "@/lib/config";
import { questionsFor } from "@/lib/engine/question";
import { entryOf, factInfo, factKeys } from "@/lib/facts";
import type {
  Direction,
  EntryId,
  FactId,
  FactSessionDetail,
  QuizConfig,
  SessionStats,
} from "@/types";

export { questionsFor, type Prompt, type QuestionType } from "@/lib/engine/question";

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
 * Build the starting deck for drill/pairs from the selected FACTS,
 * honoring length=limited + limType=count (repeat-fill then cap).
 *
 * Facts, not characters: a deck of 生 is not one card, it is however many of
 * 生's readings you selected, and each is separately gradeable.
 */
export function buildDeck(facts: FactId[], cfg: QuizConfig): FactId[] {
  let deck = shuffle(facts.slice());
  if (
    cfg.length === "limited" &&
    cfg.limType === "count" &&
    cfg.mode === "drill"
  ) {
    while (facts.length > 0 && deck.length < cfg.limCount) {
      deck = deck.concat(shuffle(facts.slice()));
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
//
// All three delegate to the fact's subject (see engine/question.ts). They stay
// here as the drill screen's front door, but they no longer know what a kana
// is, and none of them takes a character.

/** Case/whitespace-forgiving check of a typed answer for `fact` in `dir`. */
export function checkTyped(
  fact: FactId,
  given: string,
  dir: Direction = "jp2en",
): boolean {
  return questionsFor(fact).check(fact, dir, given);
}

/**
 * The ENTRY a wrong answer names, for confusion tracking — or null.
 *
 * Entry, not fact, and not a character: a confusion is a failure to tell two
 * things apart, and the things you mix up are 生 and 先, never one of 生's
 * readings with one of 先's. Searching the DISTRACTORS rather than the whole
 * dictionary is what keeps this honest and cheap — the pool of things you
 * could plausibly have meant is exactly the pool the question offered.
 */
export function confusedWith(fact: FactId, given: string): EntryId | null {
  const q = questionsFor(fact);
  const g = given.trim().toLowerCase();
  if (!g) return null;
  for (const other of q.distractors(fact, BEHAVIOR.mcOptions * 4)) {
    const info = factInfo(other);
    if (!info) continue;
    if (info.answers.some((a) => a.trim().toLowerCase() === g)) {
      return entryOf(other);
    }
  }
  return null;
}

/**
 * Multiple-choice options for `fact`, as FACTS: the answer plus its subject's
 * distractors, shuffled, at most BEHAVIOR.mcOptions.
 *
 * May return fewer — a word has no confusable data, so it gets no distractors
 * and MC degrades to a single option rather than three absurd ones. The drill
 * screen checks the length and falls back to typed.
 */
export function buildMcOptions(fact: FactId): FactId[] {
  const distractors = questionsFor(fact).distractors(fact, BEHAVIOR.mcOptions - 1);
  return shuffle([fact, ...distractors].slice(0, BEHAVIOR.mcOptions));
}

/** Retries allowed under cfg: none → 0, lim → retryN, unl → Infinity. */
export function retriesAllowed(cfg: QuizConfig): number {
  return cfg.retries === "unl" ? Infinity : cfg.retries === "none" ? 0 : cfg.retryN;
}

// ---------- stats ----------

/** Fresh per-fact stat record. */
export function newFactStat(): FactSessionDetail {
  return {
    seen: 0,
    misses: 0,
    everCorrect: false,
    firstTryCorrect: null,
    // Showings answered right. everCorrect asks "did you EVER get it" (a
    // yes/no over the run); this counts how many of the showings you landed,
    // and is the forgiving numerator — see src/lib/accuracy.ts.
    correct: 0,
    slow: 0,
    confused: {},
  };
}

export interface ResultsSummary {
  facts: FactId[];
  total: number;
  forg: number;
  strict: number;
  slow: number;
}

/** Totals for the results screen (forgiving vs strict + slow count). */
export function computeResults(stats: SessionStats): ResultsSummary {
  const facts = factKeys(stats);
  const total = facts.length;
  const forg = facts.filter((f) => stats[f].everCorrect).length;
  const strict = facts.filter((f) => stats[f].firstTryCorrect === true).length;
  const slow = facts.reduce((n, f) => n + stats[f].slow, 0);
  return { facts, total, forg, strict, slow };
}

/** Facts counting as "missed" under the given view, most misses first. */
export function missedFacts(
  stats: SessionStats,
  view: "forg" | "strict",
): FactId[] {
  return factKeys(stats)
    .filter((f) =>
      view === "forg"
        ? stats[f].misses > 0 || !stats[f].everCorrect
        : stats[f].firstTryCorrect !== true,
    )
    .sort((a, b) => stats[b].misses - stats[a].misses);
}

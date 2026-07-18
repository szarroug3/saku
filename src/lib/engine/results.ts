// The results/stats totals — the PURE part of the engine, split out of
// src/lib/engine/index.ts.
//
// These functions read only a SessionStats object and `factKeys` (an
// Object.keys cast); they never touch the fact registry, question logic, or any
// subject data. The barrel (engine/index.ts) does — it imports facts.ts and
// engine/question.ts for `confusedWith`, `buildMcOptions`, `checkTyped` — so a
// module that only needs the totals (the always-mounted QuizSessionProvider)
// importing them FROM the barrel pulled the whole ~3.6 MB vocab+kanji payload
// into the eager client bundle. Importing from here instead stays light.
//
// engine/index.ts re-exports everything below, so existing `@/lib/engine`
// consumers are unchanged. This changes no behaviour.

import { factKeys } from "@/lib/fact-keys";
import type { FactId, SessionStats } from "@/types";

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

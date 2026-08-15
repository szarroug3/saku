// The one place accuracy is defined. Every screen — the drill HUD, the Home
// deck rings, the character picker circles — reads through here, so the number
// always means the same thing.
//
// Both metrics count SHOWINGS and divide by the same denominator — only the
// numerator differs, so the two numbers are directly comparable:
//   seen     = times a fact was SHOWN as a question
//   firstTry = showings answered right on the first attempt
//   correct  = showings answered right at all (first try or after retries)
//   missed   = wrong ATTEMPTS; one showing can produce several. Never a
//              denominator — mixing units is what made the legacy app print
//              negative accuracies.
//
//   strict    = firstTry / seen   — "how often did you nail it immediately"
//   forgiving = correct  / seen   — "how often did you get it at all"
//
// A showing that ended without a correct answer (quiz ended early, grid card
// left blank) scores 0 under both. The old forgiving formula,
// seen / (seen + missed), reported that same never-answered showing as 100%.
//
// ACCURACY IS TWO DIFFERENT NUMBERS
// =================================
// That was the last two-denominator trap. This is the next one, and it is
// worse, because both readings are arithmetically legal:
//
//   A FACT's accuracy is a RATIO. firstTry / seen, both counted over the same
//   showings. It is a measurement. You can pool it with other facts' counts and
//   divide again, and the result still measures something: "88% of your
//   hiragana showings were right" is true of a real population of showings.
//
//   An ENTRY's accuracy is a SUMMARY. 生 has eleven readings; there is no
//   population of "showings of 生" to take a ratio over, because "what is the
//   reading of 生" is not a question anyone can be graded on. All you can
//   honestly do is average what its facts each scored — and an average of
//   ratios is not a ratio. Pooling instead would weight セイ by how often you
//   happened to drill it, and report "生: 61%", a number true of nothing.
//
// So an entry's accuracy is NEVER a valid denominator, and never comparable
// with a fact's. The split is enforced by the types, not by this comment:
//
//   - the pooling functions take `FactId[]`. An `EntryId` will not compile.
//   - an entry's accuracy comes back as `EntrySummary`, an OBJECT. You cannot
//     divide by it, add it to anything, or hand it to `accuracyOf`.
//
// Nothing stops someone writing `accuracyFor(history, factsOf(entry))` and
// pooling an entry by hand. That is the point: it would be a deliberate,
// legible act, spelled out at the call site, rather than the thing that
// happens by default when you reach for the obvious function.

import { EMPTY_COUNTS } from "@/lib/fact-counts";
import type { FactCounts, FactId } from "@/types";

// This module is CONTENT-FREE (no fact registry, no dictionary), so any history-
// touching route can do accuracy math without pulling the ~8.6 MB curriculum
// content. The one function that needed `factsOf` — `summaryOfEntry` — lives in
// entry-summary.ts for exactly that reason; `EMPTY_COUNTS` likewise moved to
// fact-counts.ts and is re-exported here so accuracy.ts's own callers are unchanged.
export { EMPTY_COUNTS };

/**
 * The least a thing must be for an accuracy to be read off it: counts, per
 * fact. Every function below takes THIS and not `HistoryFile`.
 *
 * A HistoryFile satisfies it, since a FactAggregate is a FactCounts plus the
 * scoring state these functions have no business reading. So does one session's
 * `facts` map, which the trend chart hands over one run at a time to get the
 * same definition of accuracy the rest of the app uses — and which, since
 * sessions carry counts and never state, is no longer even shaped like a
 * history. Asking for the minimum is what lets both be true at once.
 */
export interface CountsByFact {
  facts: Record<FactId, FactCounts>;
}

/**
 * Pool counts over a set of FACTS.
 *
 * Legitimate because every field is a COUNT of showings, so the sum counts a
 * real, larger population and the ratio taken from it measures that population.
 * See the header for why the same operation over ONE ENTRY's facts is not.
 *
 * Takes and returns `FactCounts`, NOT `FactAggregate`, and that is the third
 * fence in this file rather than a tidier import. A stored fact also carries a
 * FactState — a stability and a lastTested — and those do not sum: "the
 * stability of hiragana basic" is not a quantity, it is 71 separate
 * predictions. Returning the counts type means the pooled object has no
 * `stability` field at all, so summing one is a compile error instead of a
 * plausible number that would then order a drill list. Same disease as the
 * entry/fact accuracy split above, one level down.
 */
export function totalFor(history: CountsByFact, facts: FactId[]): FactCounts {
  const total = { ...EMPTY_COUNTS };
  for (const f of facts) {
    const a = history.facts[f];
    if (!a) continue;
    total.seen += a.seen;
    total.missed += a.missed;
    total.firstTry += a.firstTry ?? 0;
    total.correct += a.correct ?? 0;
  }
  return total;
}

/** Accuracy 0–100 — a real ratio — or null when never practised. */
export function accuracyOf(
  agg: FactCounts,
): number | null {
  if (!agg.seen) return null;
  const ratio = (agg.firstTry ?? 0) / agg.seen;
  return Math.max(0, Math.min(100, Math.round(100 * ratio)));
}

/** Pooled accuracy 0–100 over a group of FACTS — a deck ring, a run — or null
 * when none of them has ever been practised. A ratio: safe to compare. */
export function accuracyFor(
  history: CountsByFact,
  facts: FactId[],
): number | null {
  return accuracyOf(totalFor(history, facts));
}

/**
 * What an ENTRY scored: the mean of its facts' accuracies.
 *
 * An object rather than a number, and that is the whole design. `meanPct` is
 * not a measurement of anything — it is an average of measurements — so the
 * type refuses to let it be divided by, summed, or mistaken for the output of
 * `accuracyOf`. Read it, render it, and do no arithmetic with it.
 *
 * Facts the user has never seen are left out: an unpractised reading is
 * unknown, not 0%, and averaging a 0 in for it would invent a weakness.
 */
export interface EntrySummary {
  /** Mean of the entry's practised facts' accuracies, 0–100. A SUMMARY. */
  readonly meanPct: number;
  /** How many facts that mean is over — 1 for a kana, up to ~11 for a kanji.
   * The honest caveat to print next to it. */
  readonly facts: number;
  /** Total showings across those facts. A COUNT, so it really does sum, and
   * it is what ranks a well-evidenced weakness above a one-showing fluke. */
  readonly seen: number;
}

// `summaryOfEntry` (an entry's mean accuracy across its facts) lived here but
// needed `factsOf`; it now lives in entry-summary.ts so this module stays content-
// free. `EntrySummary` (its result shape) stays here beside `formatSummary`.

/** "88%" — always carries the unit so the ring can't be misread as a count. */
export function formatAccuracy(pct: number | null): string {
  return pct === null ? "—" : `${pct}%`;
}

/** An entry summary, formatted. Separate from `formatAccuracy` so that a
 * summary cannot reach a screen without someone having said it was one. */
export function formatSummary(s: EntrySummary | null): string {
  return formatAccuracy(s?.meanPct ?? null);
}

/** Practice volume for a group of facts: total showings. A count, not a rate. */
export function volumeFor(history: CountsByFact, facts: FactId[]): number {
  return totalFor(history, facts).seen;
}

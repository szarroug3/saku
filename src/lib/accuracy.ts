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

import { factsOf } from "@/lib/facts";
import type {
  AccuracyMetric,
  EntryId,
  FactAggregate,
  FactId,
  HistoryFile,
} from "@/types";

export const EMPTY_AGGREGATE: FactAggregate = {
  seen: 0,
  missed: 0,
  slow: 0,
  firstTry: 0,
  correct: 0,
};

/**
 * Pool aggregates over a set of FACTS.
 *
 * Legitimate because every field is a COUNT of showings, so the sum counts a
 * real, larger population and the ratio taken from it measures that population.
 * See the header for why the same operation over ONE ENTRY's facts is not.
 */
export function totalFor(
  history: HistoryFile,
  facts: FactId[],
): FactAggregate {
  const total = { ...EMPTY_AGGREGATE };
  for (const f of facts) {
    const a = history.facts[f];
    if (!a) continue;
    total.seen += a.seen;
    total.missed += a.missed;
    total.slow += a.slow;
    total.firstTry += a.firstTry ?? 0;
    total.correct += a.correct ?? 0;
  }
  return total;
}

/** Accuracy 0–100 under `metric` — a real ratio — or null when never
 * practised. */
export function accuracyOf(
  agg: FactAggregate,
  metric: AccuracyMetric,
): number | null {
  if (!agg.seen) return null;
  const ratio =
    metric === "firstTry"
      ? (agg.firstTry ?? 0) / agg.seen
      : (agg.correct ?? 0) / agg.seen;
  return Math.max(0, Math.min(100, Math.round(100 * ratio)));
}

/** Pooled accuracy 0–100 over a group of FACTS — a deck ring, a run — or null
 * when none of them has ever been practised. A ratio: safe to compare. */
export function accuracyFor(
  history: HistoryFile,
  facts: FactId[],
  metric: AccuracyMetric,
): number | null {
  return accuracyOf(totalFor(history, facts), metric);
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

/** An entry's summary accuracy, or null when none of its facts is practised. */
export function summaryOfEntry(
  history: HistoryFile,
  entry: EntryId,
  metric: AccuracyMetric,
): EntrySummary | null {
  let sum = 0;
  let facts = 0;
  let seen = 0;
  for (const f of factsOf(entry)) {
    const agg = history.facts[f];
    const pct = agg ? accuracyOf(agg, metric) : null;
    if (pct === null) continue; // never practised — unknown, not zero
    sum += pct;
    facts++;
    seen += agg!.seen;
  }
  if (!facts) return null;
  return { meanPct: Math.round(sum / facts), facts, seen };
}

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
export function volumeFor(history: HistoryFile, facts: FactId[]): number {
  return totalFor(history, facts).seen;
}

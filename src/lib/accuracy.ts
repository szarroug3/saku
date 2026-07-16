// The one place accuracy is defined. Every screen — the drill HUD, the Home
// deck rings, the character picker circles — reads through here, so the number
// always means the same thing.
//
// Both metrics count SHOWINGS and divide by the same denominator — only the
// numerator differs, so the two numbers are directly comparable:
//   seen     = times a character was SHOWN as a question
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

import type { AccuracyMetric, CharAggregate, HistoryFile } from "@/types";

export const EMPTY_AGGREGATE: CharAggregate = {
  seen: 0,
  missed: 0,
  slow: 0,
  firstTry: 0,
  correct: 0,
};

/** Sum aggregates over a set of characters. */
export function totalFor(
  history: HistoryFile,
  chars: string[],
): CharAggregate {
  const total = { ...EMPTY_AGGREGATE };
  for (const c of chars) {
    const a = history.chars[c];
    if (!a) continue;
    total.seen += a.seen;
    total.missed += a.missed;
    total.slow += a.slow;
    total.firstTry += a.firstTry ?? 0;
    total.correct += a.correct ?? 0;
  }
  return total;
}

/** Accuracy 0–100 under `metric`, or null when never practised. */
export function accuracyOf(
  agg: CharAggregate,
  metric: AccuracyMetric,
): number | null {
  if (!agg.seen) return null;
  const ratio =
    metric === "firstTry"
      ? (agg.firstTry ?? 0) / agg.seen
      : (agg.correct ?? 0) / agg.seen;
  return Math.max(0, Math.min(100, Math.round(100 * ratio)));
}

/** Accuracy 0–100 over a group of characters, or null when never practised. */
export function accuracyFor(
  history: HistoryFile,
  chars: string[],
  metric: AccuracyMetric,
): number | null {
  return accuracyOf(totalFor(history, chars), metric);
}

/** "88%" — always carries the unit so the ring can't be misread as a count. */
export function formatAccuracy(pct: number | null): string {
  return pct === null ? "—" : `${pct}%`;
}

/** Practice volume for a group: total showings across its characters. */
export function volumeFor(history: HistoryFile, chars: string[]): number {
  return totalFor(history, chars).seen;
}

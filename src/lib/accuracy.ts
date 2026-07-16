// The one place accuracy is defined. Every screen — the drill HUD, the Home
// deck rings, the character picker circles — reads through here, so the number
// always means the same thing.
//
// Two denominators exist and must not be mixed (the legacy app mixed them and
// produced negative accuracies):
//   seen    = times a character was SHOWN as a question
//   missed  = wrong ATTEMPTS; one showing can produce several
//   firstTry = showings answered right on the first attempt
//
//   strict    = firstTry / seen          — "nailed it immediately"
//   forgiving = seen / (seen + missed)   — "share of attempts correct"

import type { AccuracyMetric, CharAggregate, HistoryFile } from "@/types";

export const EMPTY_AGGREGATE: CharAggregate = {
  seen: 0,
  missed: 0,
  slow: 0,
  firstTry: 0,
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
      ? agg.firstTry / agg.seen
      : agg.seen / (agg.seen + agg.missed);
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

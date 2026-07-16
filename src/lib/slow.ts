// What counts as "slow but right".
//
// It used to be a hardcoded 5 seconds, ported from the Python. That number is
// only meaningful if your personal distribution happens to sit near it:
//
//   six months in (median 1.2s)  →  5s flags NOTHING. The feature is dead,
//                                   even though your 3s cards are real stalls.
//   month one     (median 4.5s)  →  5s flags HALF the run. True, and useless:
//                                   you are new, you are slow at everything.
//
// A percentile (p95) is the obvious fix and the wrong one: it flags a fixed
// fraction BY DEFINITION, so a flawless fast run still reports its slowest 5%,
// and "nothing was slow" becomes unreachable. An outlier rule has to be able
// to return zero — that is what makes a clean run earnable.
//
// So: median + 3·MAD, the classic robust rule. MAD (median absolute deviation)
// is your typical variability; unlike standard deviation, outliers cannot
// inflate it, so a few slow cards can't raise the very bar meant to catch them.
// It adapts to your speed AND your consistency, and it returns nothing when
// you were uniformly quick.
//
// Two guardrails:
//   - a floor (cfg.slowFloorMs): get fast and steady enough and 3·MAD shrinks
//     to nothing — a 1.6s answer is not "hesitation" in any useful sense.
//   - separate baselines per answer STYLE: clicking a multiple-choice button
//     and typing "kyo" are different acts, and one pooled median would drag
//     the typed threshold down.
//
// What is measured is recall latency — question shown → FIRST KEYSTROKE, not
// → submit. Everything after the first keystroke is typing, which is motor
// skill, not recognition: charging ぎゃ for three keystrokes that あ never pays
// would make long romaji look like hesitation. For multiple choice,
// time-to-click is already pure recall.

import { BEHAVIOR } from "@/lib/config";

/** Recall latencies are kept per answer style — see the header. */
export type LatencyStyle = "typed" | "mc";

/** A rolling window of recent recall latencies, per style. Bounded so the
 * baseline tracks who you are NOW: a month of beginner times should not still
 * be setting the bar once you are fast. */
export type LatencyWindow = Partial<Record<LatencyStyle, number[]>>;

/** Median of a numeric array. Returns null for an empty one — "no data" is a
 * real answer here, not zero. */
export function median(xs: number[]): number | null {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const mid = s.length >> 1;
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

/** Median absolute deviation: the median of |x − median|. Robust — a handful
 * of huge outliers leave it unmoved, which is exactly why it can be used to
 * detect them. */
export function mad(xs: number[]): number | null {
  const m = median(xs);
  if (m === null) return null;
  return median(xs.map((x) => Math.abs(x - m)));
}

/**
 * The slow threshold in ms for one style, or null when there isn't enough
 * history to say anything honest — with only a couple of samples the median
 * is noise, and flagging on noise is worse than not flagging.
 */
export function slowThreshold(
  latencies: number[],
  floorMs: number,
): number | null {
  if (latencies.length < BEHAVIOR.slowMinSamples) return null;
  const m = median(latencies);
  const d = mad(latencies);
  if (m === null || d === null) return null;
  return Math.max(floorMs, m + BEHAVIOR.slowMadMultiplier * d);
}

/** Was this answer a hesitation, judged against your own recent latencies for
 * the same answer style? False when there isn't enough history to judge. */
export function isSlow(
  latencyMs: number,
  window: LatencyWindow,
  style: LatencyStyle,
  floorMs: number,
): boolean {
  const t = slowThreshold(window[style] ?? [], floorMs);
  return t !== null && latencyMs > t;
}

/** Append a latency to the rolling window, trimming to the newest
 * BEHAVIOR.slowWindow samples. Pure: returns a new window. */
export function recordLatency(
  window: LatencyWindow,
  style: LatencyStyle,
  latencyMs: number,
): LatencyWindow {
  const next = [...(window[style] ?? []), latencyMs];
  return {
    ...window,
    [style]: next.slice(-BEHAVIOR.slowWindow),
  };
}

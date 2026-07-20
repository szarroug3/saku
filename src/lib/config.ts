// Behavior knobs and font pool ported from legacy/theme.py.

import { availableFonts } from "@/lib/font-detect";

export const BEHAVIOR = {
  // ---------- what counts as a hesitation (see src/lib/slow.ts) ----------
  /** How many MADs above your median median counts as an outlier. 3 is the
   * standard robust-outlier constant; it is a knob with a right answer, so it
   * lives here rather than in Settings. The floor (cfg.slowFloorMs) and the
   * graduation count ARE judgement calls, so those are user settings. */
  slowMadMultiplier: 3,
  /** Recent recall latencies kept per answer style. Bounded so the baseline
   * tracks who you are now, not who you were a month ago. */
  slowWindow: 60,
  /** Below this many samples the median is noise, and flagging on noise is
   * worse than not flagging: no slow verdicts until there's a baseline. */
  slowMinSamples: 8,
  /** @deprecated The old fixed threshold. Only still here as the fallback for
   * the cold start, before there are enough samples to compute a personal
   * one — never as the steady-state rule. */
  slowAnswerMs: 5000,
  /** A missed card comes back 3–7 questions later. */
  requeueMin: 3,
  requeueMax: 7,
  /** Options per multiple-choice question. */
  mcOptions: 6,
  /** Pairs per match-the-pairs board. */
  pairsPerBoard: 8,
  /** First-try-correct in a row before the streak pill appears at all — below
   * this it isn't a streak yet, and "🔥 0" reports a failure as a stat. */
  streakMin: 3,
} as const;

/** Fonts installed on the machine — the Settings page offers these as a
 * multi-select; each card draws randomly from the SELECTED ones so a single
 * typeface doesn't get memorized. Names must be installed fonts. */
export const JP_FONTS = [
  "'Hiragino Sans'",
  "'Hiragino Mincho ProN'",
  "'Hiragino Maru Gothic ProN'",
  "'Yu Gothic'",
  "'Yu Mincho'",
  "'Klee'",
  "'Tsukushi A Round Gothic'",
  "'Toppan Bunkyu Gothic'",
] as const;

/** Random font from the user's selection (one selected = always that one).
 *
 * Filtered to fonts this machine actually HAS. Often half the pool isn't
 * installed on a given machine, and an uninstalled family doesn't error — it silently renders as
 * the fallback, so the pool quietly shrinks and every "different" font is the
 * same one. Filtering here means a saved selection from another machine, or a
 * font uninstalled since, degrades to the fonts that exist instead of to a
 * fallback pretending to be five typefaces. */
export function pickFont(fonts: string[]): string {
  const usable = availableFonts(fonts);
  const pool = usable.length ? usable : availableFonts(JP_FONTS);
  const family = pool.length ? pool[Math.floor(Math.random() * pool.length)] : JP_FONTS[0];
  return `${family}, sans-serif`;
}

/** Display name for a font pool entry ("'Hiragino Sans'" → "Hiragino Sans"). */
export function fontLabel(font: string): string {
  return font.replace(/^'|'$/g, "");
}

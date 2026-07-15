// Behavior knobs and font pool ported from legacy/theme.py.

export const BEHAVIOR = {
  /** Size of the big character on the drill card, px. */
  cardSizePx: 96,
  /** Correct-but-slower-than-this gets flagged. */
  slowAnswerMs: 5000,
  /** A missed card comes back 3–7 questions later. */
  requeueMin: 3,
  requeueMax: 7,
  /** Options per multiple-choice question. */
  mcOptions: 6,
  /** Pairs per match-the-pairs board. */
  pairsPerBoard: 8,
  /** Random Japanese font per card (default for the setting). */
  randomFont: true,
} as const;

/** Fonts installed on the machine — each card draws a random one so a single
 * typeface doesn't get memorized. */
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

export function randomJpFont(enabled: boolean): string {
  const font = enabled
    ? JP_FONTS[Math.floor(Math.random() * JP_FONTS.length)]
    : JP_FONTS[0];
  return `${font}, sans-serif`;
}

// Lesson-size defaults and clamps — the PURE config knobs, split out of
// kanji-lesson.ts and word-lesson.ts.
//
// WHY THIS IS ITS OWN FILE
// ========================
// These are constants and integer-clamp math; they touch no kanji or vocab
// data. But they used to live in kanji-lesson.ts / word-lesson.ts, which
// top-level import the full KANJI_ORDER and VOCAB curricula. The always-mounted
// QuizConfigProvider (src/lib/quiz-config.tsx) reaches for exactly these
// defaults to seed a config — and by importing them from those modules it
// dragged the whole ~3.6 MB kanji+vocab payload into the eager client bundle on
// every route. Splitting the pure knobs out cuts that edge; the lesson modules
// re-export them so their own call sites are unchanged. No behaviour changes.

/**
 * How long a kanji lesson should be, in draw+assembly cost — the two numbers
 * the owner sets.
 */
export interface LessonRange {
  /** The floor a lesson is filled toward. A lesson ends below it only when the
   * next indivisible bundle would push over `max`, or the material runs out. */
  min: number;
  /** The ceiling. Never exceeded except by a single bundle that cannot be split
   * and is bigger than it on its own — 鬱 alone is 21. Those lessons are flagged
   * `over` and the card says so, rather than the number quietly lying. */
  max: number;
}

/** 5 and 7: a short sitting is roughly a couple of ordinary kanji, a long one
 * three or so. Anchored to nothing but how long a beginner's session should
 * feel. The only range there is: nothing offers a learner another one. */
export const LESSON_RANGE_DEFAULT: LessonRange = { min: 5, max: 7 };

// There used to be a `clampLessonRange` here, pinning a stored max at or above
// its min on both the Settings control and the config-load path. Neither exists
// any more: the control went with the old app and the config field with SAK-373,
// so every caller now passes LESSON_RANGE_DEFAULT, which needs no clamping.

/** Words met in one sitting. A single number, not a min/max: a word is
 * indivisible and uniform, so there is no "bundle bigger than the ceiling" case
 * the kanji range exists to handle. */
export const WORDS_PER_LESSON_DEFAULT = 6;

/** Clamp a stored/edited count to a sane lesson size — whole, at least 1. Same
 * instinct the kanji range had: a corrupt value should degrade to a small
 * lesson, not a blank screen. Capped so a hand-edit can't ask for a 500-word
 * teach screen. */
export function clampWordsPerLesson(n: number): number {
  const v = Math.round(Number.isFinite(n) ? n : WORDS_PER_LESSON_DEFAULT);
  return Math.min(20, Math.max(1, v));
}

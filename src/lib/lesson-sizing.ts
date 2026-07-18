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

/** 6 and 12: a short sitting is roughly two or three ordinary kanji, a long one
 * half a dozen. Anchored to nothing but how long a beginner's session should
 * feel; move them in Settings. */
export const LESSON_RANGE_DEFAULT: LessonRange = { min: 6, max: 12 };

/**
 * The one place a kanji range is made safe, and it is called on BOTH sides —
 * the Settings control and the config-load path — so a `max` below `min` cannot
 * reach the packer even through hand-edited localStorage.
 *
 * A packer handed max < min has no defined behaviour (fill toward a ceiling
 * under the floor?), so this does not trust the caller to have checked: `max`
 * is pinned at or above `min`, and both are whole and at least 1. It is a clamp
 * and not a throw because a bad stored value should degrade to a sane lesson,
 * not a blank screen — the same instinct history.ts has about stale data.
 */
export function clampLessonRange(min: number, max: number): LessonRange {
  const lo = Math.max(1, Math.round(Number.isFinite(min) ? min : LESSON_RANGE_DEFAULT.min));
  const hi = Math.max(lo, Math.round(Number.isFinite(max) ? max : LESSON_RANGE_DEFAULT.max));
  return { min: lo, max: hi };
}

/** Words met in one sitting. A single number, not a min/max: a word is
 * indivisible and uniform, so there is no "bundle bigger than the ceiling" case
 * the kanji range exists to handle. */
export const WORDS_PER_LESSON_DEFAULT = 6;

/** Clamp a stored/edited count to a sane lesson size — whole, at least 1. Same
 * instinct as `clampLessonRange`: a corrupt value should degrade to a small
 * lesson, not a blank screen. Capped so a hand-edit can't ask for a 500-word
 * teach screen. */
export function clampWordsPerLesson(n: number): number {
  const v = Math.round(Number.isFinite(n) ? n : WORDS_PER_LESSON_DEFAULT);
  return Math.min(20, Math.max(1, v));
}

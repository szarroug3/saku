// The grammar track: the fourth curriculum, and the one whose "how many are
// there" the data refuses to answer on purpose (see src/data/grammar/recipes.ts).
//
// That refusal is about JAPANESE and it stands. This file still publishes a
// GRAMMAR_CURRICULUM_TOTAL, because "how many patterns does this track teach"
// is a question about the app rather than the subject — the distinction, and
// why the answer is every authored recipe, is argued at that constant.
//
// WHY THIS IS word-lesson.ts, NOT kanji-lesson.ts
// ===============================================
// Kanji sizes a lesson by COST — the draw+assembly work of learning a shape —
// and packs the 2,136 into fixed groups once. A pattern has no such cost: it is
// a form the conjugation engine already generates plus a fixed string (〜てから
// is [V-て] + から). Learning one is meeting one, and the honest unit is how
// many of them you meet in a sitting. So this file is the words track's twin, a
// COUNT of new patterns, not a cost range — a PURE function of history with no
// cursor, exactly as kana, kanji and words manage it.
//
// WHAT THE TRACK TEACHES
// ======================
// ALL authored patterns. A DRILLABLE pattern — one `isProducible` says can carry a
// production question with ONE answer — is taught by meaning AND production. A
// non-producible pattern (a wrap like 〜しか〜ない, or a vacuous one like 〜は〜より
// whose "production" is just retyping) carries only a MEANING fact, so it is
// taught by a teach page and quizzed by meaning multiple choice, with no
// production half. Both are real lessons; the only difference is whether the
// quiz has a production question, which data/grammar/index.ts settles by minting
// a production fact for the drillable rows and none for the rest.
//
// THE ORDER, AND THE ONE DECISION THE DATA DOESN'T SETTLE
// ======================================================
// The recipe table is grouped by what a pattern DOES (all the て-form jobs
// together, all seven "must" patterns together) and, WITHIN a group, N5 before
// N4. That grouping is the pedagogy — you learn the て-family as a family — but
// it interleaves the two JLPT levels ACROSS groups: the て group runs N5→N4,
// then the ない group starts again at N5. There is no single authored sequence
// that is both "grouped by function" and "all N5 before any N4".
//
// A beginner meeting grammar for the first time (the moment this track opens,
// right after kana) wants the easier half first. So the teaching order is all
// the recipes sorted N5-before-N4, STABLY — which preserves the authored
// within-level order (and thus the functional grouping inside each level) while
// guaranteeing no N4 pattern is taught before the N5 patterns. This is a
// curriculum call the data leaves open; it is flagged for owner review. Change
// the sort here and the whole grammar curriculum re-cuts, with no cursor to
// migrate, because there is no cursor.

import { effectiveState } from "@/lib/claims";
import type { LessonPosition } from "@/lib/lesson-position";
import { GRAMMAR_SUBJECT, patternMeaningFactId } from "@/data/grammar";
import { RECIPES, type Level, type Recipe } from "@/data/grammar/recipes";
import { CURRICULUM_LESSONS, type GrammarLessonDef } from "@/data/grammar/lessons";
import type { FactId, HistoryFile } from "@/types";

/**
 * How many NEW patterns a lesson teaches. The grammar analogue of the words
 * track's WORDS_PER_LESSON_DEFAULT — a COUNT, not a cost, because a pattern is
 * uniform and indivisible and adds no new material to draw.
 *
 * Smaller than the words default (6) on purpose: a pattern is denser than a
 * word — it carries a meaning AND, usually, a production form to build — so a
 * calmer handful is the right sitting. There is deliberately NO Settings knob
 * for this (a `grammarPerLesson` control is a documented follow-on); the size
 * is a constant the caller may pass but the app never asks the user to set.
 */
export const GRAMMAR_PER_LESSON_DEFAULT = 4;

/** Clamp a passed count to a sane lesson size — whole, at least 1, capped so a
 * hand-edit can't ask for a 100-pattern teach screen. Same instinct as
 * clampWordsPerLesson. */
export function clampGrammarPerLesson(n: number): number {
  const v = Math.round(Number.isFinite(n) ? n : GRAMMAR_PER_LESSON_DEFAULT);
  return Math.min(20, Math.max(1, v));
}

/** N5 before N4 before N3 (the depth tier). The one axis the teaching order
 * sorts on; everything else is left to the authored (stable) order. N3 is the
 * structural set a learner meets AFTER the N4 core, so it sorts last — and it is
 * almost all recognition-only (see the N3 block in recipes.ts), so today no N3
 * row reaches DRILLABLE and this branch orders the aspectual N4 producers among
 * their kin. The rank is ready for the day an N3 pattern becomes producible. */
function levelRank(level: Level): number {
  return level === "N5" ? 0 : level === "N4" ? 1 : 2;
}

/** The adjective noun form introduces forms and adjective classes before the
 * て/で-form needs either idea. These two foundational forms lead the track in
 * that order; everything else keeps its level/authored order behind them. */
function foundationRank(r: Recipe): number {
  if (r.id === "prenominal-form") return 0;
  if (r.id === "te-sequence") return 1;
  if (r.id === "te-iru") return 2;
  return 3;
}

/**
 * The patterns the track teaches, in teaching order: every recipe, N5 before
 * N4 before N3, stable within a level.
 *
 * Computed once — it is a property of the data, not of the user. Every recipe is
 * taught: a producible one carries a production drill, a non-producible one
 * (vacuous, order-free, or 〜しか〜ない) carries only its meaning fact and is
 * quizzed by meaning multiple choice. The stable sort lifts every N5 ahead of
 * every N4 without disturbing the functional grouping inside each level
 * (Array.prototype.sort is stable), so the 40 non-producible patterns interleave
 * by level among their kin.
 */
export const CURRICULUM_PATTERNS: readonly Recipe[] = [...RECIPES].sort(
  (a, b) =>
    foundationRank(a) - foundationRank(b) || levelRank(a.level) - levelRank(b.level),
);

/**
 * How many patterns the track teaches — the denominator on the lesson card.
 * All authored RECIPES.
 *
 * WHY THE WHOLE TABLE NOW, AND NOT ONLY THE DRILLABLE 56
 * =====================================================
 * The 40 non-producible recipes are real grammar the learner has to meet, and
 * the track now teaches them: each carries a MEANING fact, so it gets a teach
 * page and is quizzed by meaning multiple choice, with no production drill.
 * That makes them lessons like any other, so the denominator — a promise about
 * the TRACK, "keep going and you will have met all of these" — counts them. The
 * only thing a non-producible pattern lacks is the production half of its quiz,
 * which is a property of the QUESTION, not of whether the pattern is taught.
 *
 * AND THE HEADER OF recipes.ts IS NOT AN OBJECTION TO THIS
 * =======================================================
 * That file argues at length that "how many grammar points are there" has no
 * answer — vendors count N5 at 40, 84, 125 or 132, and the JLPT withdrew its
 * own list. All true, and it is a question about JAPANESE. This is a different
 * question with a different subject: how many patterns does THIS app's grammar
 * track teach? That one has an answer, because we authored the table. Printing
 * 96 claims nothing about the language; it claims something about the app, which
 * is exactly the kind of claim a progress counter is allowed to make.
 */
export const GRAMMAR_CURRICULUM_TOTAL = CURRICULUM_PATTERNS.length;

/** A recipe by its id — for recovering the pattern a lesson is built around
 * (its card tile and its host gate). */
const RECIPE_BY_ID: ReadonlyMap<string, Recipe> = new Map(RECIPES.map((r) => [r.id, r]));

/** A fact the app has no record of — never answered, never claimed, never
 * "quiz me"'d. The one definition of "new", the same `lastTested === 0` rule
 * word-lesson.ts reads per fact. */
function isFresh(fact: FactId, history: HistoryFile): boolean {
  const state = effectiveState(
    history.facts[fact],
    history.claims?.[fact],
    history.seen?.[fact],
  );
  return state.lastTested === 0;
}

/** The て/で-form — grammar lesson 2, the recipe every other te-pattern builds
 * on (see teFormFirst). Named once here so the words track, which holds words
 * with an unintroduced conjugation class back until this is learned, reads the id from grammar rather
 * than spelling it out itself. */
export const TE_FORM_RECIPE = "te-sequence";
export const ADJECTIVE_PRENOMINAL_RECIPE = "prenominal-form";

/**
 * Has the learner learned the て-form yet?
 *
 * True once its meaning fact is no longer fresh — tested, claimed, or "quiz
 * me"'d — the exact "learned, not merely on screen" signal every gate in the
 * app reads. The WORDS track reads this for conjugating words whose class needs
 * the lesson's introduction: ambiguous る-ending verbs. The Words track holds
 * them back until grammar lesson 2 is done and their word lessons can name the
 * class. Grammar itself never waits on vocabulary.
 */
export function teFormLearned(history: HistoryFile): boolean {
  return !isFresh(patternMeaningFactId(TE_FORM_RECIPE), history);
}

/** Has the learner completed the first grammar lesson, which introduces the
 * adjective classes and the な form used before a noun? */
export function adjectivePrenominalLearned(history: HistoryFile): boolean {
  return !isFresh(patternMeaningFactId(ADJECTIVE_PRENOMINAL_RECIPE), history);
}

/** One pattern, ready to render on a lesson card. */
export interface GrammarCard {
  /** The recipe id — the key the drill's facts hang off. */
  id: string;
  /** How the pattern is written. 〜てから */
  pattern: string;
  /** The optional Japanese sense label, shown as a quiet second line so two
   * patterns that share a bare form (〜られる 可能 vs 受身) read apart. */
  sense?: string;
  /** The terse functional gloss. "after doing X" */
  gloss: string;
  /** N5 or N4, for a quiet level tag on the card. */
  level: Level;
}

/** The next grammar lesson: the patterns to teach, their facts, and where you
 * are. */
export interface GrammarLesson {
  cards: GrammarCard[];
  facts: FactId[];
  /**
   * Where you are, in SITTINGS — "lesson N of X".
   *
   * A sitting is what the learner meets at once: one form lesson, or a bundle of
   * up to three pattern lessons (see GRAMMAR_SITTINGS). It is the honest unit for
   * "lesson N of X" now that a card can hold more than one pattern: counting the
   * a pattern span would put several numbers on a card that is really one
   * sitting. `from === to` always: the item IS the current sitting, so the span
   * is a single number and `total` is the sitting count. The pattern total (96)
   * is still exported as GRAMMAR_CURRICULUM_TOTAL for callers that count patterns
   * rather than sittings.
   */
  position: LessonPosition;
}

function toCard(r: Recipe): GrammarCard {
  return { id: r.id, pattern: r.pattern, sense: r.sense, gloss: r.gloss, level: r.level };
}

/** Has the learner met any grammar pattern at all? The words track's
 * `hasStartedWordTrack`, for grammar: it decides whether a LOCKED grammar card
 * is shown (only after the track has opened) versus hidden entirely. */
export function hasStartedGrammarTrack(history: HistoryFile): boolean {
  for (const r of CURRICULUM_PATTERNS) {
    if (!isFresh(patternMeaningFactId(r.id), history)) return true;
  }
  return false;
}

/** The next teachable lesson and its ordinal, or null when the track is done.
 * The first lesson whose primary pattern's MEANING fact is still fresh — the
 * same per-pattern freshness the track advanced on before, now read one lesson
 * at a time. Its index IS its position in the track (every earlier lesson is
 * met), so `index + 1` is the "lesson N" the card shows. Shared by the lesson
 * and the lock so the two can never disagree about which lesson is next. */
function nextLessonAt(
  history: HistoryFile,
): { lesson: GrammarLessonDef; index: number } | null {
  for (let i = 0; i < CURRICULUM_LESSONS.length; i++) {
    const lesson = CURRICULUM_LESSONS[i];
    if (isFresh(patternMeaningFactId(lesson.primaryPattern), history)) {
      return { lesson, index: i };
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// SITTINGS: how the grammar lessons are grouped into what a learner meets at once.
//
// A NEW FORM IS TAUGHT ALONE; ADDING AN ENDING BUNDLES
// ====================================================
// Meeting a verb conjugation form for the first time (the て-form, the ない-form,
// the potential...) is the heavy move — a whole build table, class by class — so
// its lesson gets a sitting to itself. A pattern that only bolts an ending onto a
// form the learner already has (〜てから is [V-て] + から) is the light move, so
// those bundle up to three at a time. Owner's call: "all you're doing is adding
// an ending, so we should include more material."
//
// WHICH LESSON IS A "FORM LESSON"
// ===============================
// The FIRST lesson, in teaching order, whose primary pattern's verb attaches at a
// given form — for the forms below, the ones a beginner meets as a new shape. The
// FIRST user only: 〜ている is a normal bundled pattern because it sits at the
// already-taught て-form, so it debuts no new shape.
// ---------------------------------------------------------------------------

/** The verb forms whose DEBUT lesson stands alone. `dictionary` is absent on
 * purpose (attaching at the plain form teaches no new shape), so 〜ので and the
 * other dictionary-form patterns bundle. */
const FORM_LESSON_FORMS: ReadonlySet<string> = new Set([
  "te",
  "nai",
  "ta",
  "stem",
  "masu",
  "volitional",
  "potential",
  "passive",
  "causative",
  "causativePassive",
  "ba",
  "tara",
]);

/** The verb attach form of a lesson's primary pattern, read off the recipe (the
 * same `attach.find(host === "verb").form` the form-intro placement uses), or
 * undefined when the pattern does not attach to a verb. */
function verbAttachForm(lesson: GrammarLessonDef): string | undefined {
  const recipe = RECIPE_BY_ID.get(lesson.primaryPattern);
  return recipe?.attach.find((a) => a.host === "verb")?.form ?? undefined;
}

/** The ids of the form lessons — the ones taught solo. Walk the curriculum once
 * and flag the first lesson to introduce each form. */
const FORM_LESSON_IDS: ReadonlySet<string> = (() => {
  const ids = new Set<string>();
  const seen = new Set<string>();
  for (const lesson of CURRICULUM_LESSONS) {
    const form = verbAttachForm(lesson);
    if (form && FORM_LESSON_FORMS.has(form) && !seen.has(form)) ids.add(lesson.id);
    if (form) seen.add(form);
  }
  return ids;
})();

/** Is this lesson taught by itself? */
function isFormLesson(lesson: GrammarLessonDef): boolean {
  return lesson.id === "prenominal-form" || FORM_LESSON_IDS.has(lesson.id);
}

/** How many pattern lessons ride in one bundle. A form lesson is always solo; a
 * run of pattern lessons is cut into chunks this size. */
const PATTERN_BUNDLE_MAX = 3;

/**
 * The sittings, as arrays of curriculum indices in teaching order. Deterministic
 * from CURRICULUM_LESSONS, computed once: every form lesson is a solo `[i]`, and
 * every maximal run of pattern lessons between form lessons is chunked into
 * groups of at most PATTERN_BUNDLE_MAX. A bundle never spans a form lesson, so a
 * form lesson always starts and ends its own sitting.
 */
export const GRAMMAR_SITTINGS: readonly (readonly number[])[] = (() => {
  const sittings: number[][] = [];
  const n = CURRICULUM_LESSONS.length;
  let i = 0;
  while (i < n) {
    if (isFormLesson(CURRICULUM_LESSONS[i])) {
      sittings.push([i]);
      i += 1;
      continue;
    }
    let j = i;
    while (j < n && !isFormLesson(CURRICULUM_LESSONS[j])) j += 1;
    for (let k = i; k < j; k += PATTERN_BUNDLE_MAX) {
      const chunk: number[] = [];
      for (let m = k; m < Math.min(k + PATTERN_BUNDLE_MAX, j); m++) chunk.push(m);
      sittings.push(chunk);
    }
    i = j;
  }
  return sittings;
})();

/** How many sittings the track cuts into — the denominator on the lesson card
 * ("lesson N of X"). Counts SITTINGS, not patterns: a form lesson is one
 * sitting and a pattern bundle is one sitting, so this is smaller than the
 * pattern total. */
export const GRAMMAR_SITTINGS_TOTAL = GRAMMAR_SITTINGS.length;

/** Curriculum lesson index -> the 0-based number of the sitting it belongs to.
 * The inverse of GRAMMAR_SITTINGS, for turning "the next teachable lesson" into
 * "which sitting am I in". */
const SITTING_OF_LESSON: readonly number[] = (() => {
  const map = new Array<number>(CURRICULUM_LESSONS.length).fill(0);
  GRAMMAR_SITTINGS.forEach((members, sitting) => {
    for (const idx of members) map[idx] = sitting;
  });
  return map;
})();

/**
 * The next grammar lesson, or null when there is nothing teachable to hand out.
 *
 * Find the next teachable lesson (the first whose MEANING fact is still fresh, a
 * met pattern skipped, the same signal the words track uses), then hand out its
 * whole SITTING: just that lesson if it is a form lesson, or the fresh pattern
 * lessons of its bundle (up to three) otherwise. `cards` are the sitting's
 * patterns and `facts` the union of their drills.
 *
 * There is deliberately no vocabulary host gate. Every teaching page carries
 * its own examples, so Grammar proceeds after kana regardless of progress in
 * Words. Null means only that the grammar curriculum is finished.
 *
 * PURE OF KANA. Like the other tracks, this does not know whether kana is done;
 * that gate is the caller's (see src/app/page.tsx).
 */
export function nextGrammarLesson(
  history: HistoryFile,
  // Kept for call-site compatibility; the sitting size is fixed by the grouping
  // (a form lesson solo, a pattern bundle up to three), so there is no per-call
  // size to apply.
  _count?: number,
): GrammarLesson | null {
  const next = nextLessonAt(history);
  if (!next) return null;
  const { index: startIndex } = next;

  const sittingNo = SITTING_OF_LESSON[startIndex];
  const members = GRAMMAR_SITTINGS[sittingNo];
  // Build the sitting from its still-fresh lessons at or after the teachable
  // head. Vocabulary progress never filters or truncates it.
  const chosen: GrammarLessonDef[] = [];
  for (const idx of members) {
    if (idx < startIndex) continue; // earlier members are already met, behind us
    const lesson = CURRICULUM_LESSONS[idx];
    if (!isFresh(patternMeaningFactId(lesson.primaryPattern), history)) continue;
    chosen.push(lesson);
  }
  if (chosen.length === 0) return null;

  const cards: GrammarCard[] = [];
  const facts: FactId[] = [];
  for (const lesson of chosen) {
    const recipe = RECIPE_BY_ID.get(lesson.primaryPattern);
    if (recipe) cards.push(toCard(recipe));
    facts.push(...lesson.drills);
  }

  return {
    cards,
    facts,
    position: {
      from: sittingNo + 1,
      to: sittingNo + 1,
      total: GRAMMAR_SITTINGS_TOTAL,
    },
  };
}

/** The subject these lessons belong to. Re-exported so a caller holding a
 * lesson never has to reach into the data file to name it. */
export { GRAMMAR_SUBJECT };

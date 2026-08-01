// The grammar track: the fourth curriculum, and the one whose "how many are
// there" the data refuses to answer on purpose (see src/data/grammar/recipes.ts).
//
// That refusal is about JAPANESE and it stands. This file still publishes a
// GRAMMAR_CURRICULUM_TOTAL, because "how many patterns does this track teach"
// is a question about the app rather than the subject — the distinction, and
// why the answer is all 96 authored recipes, is argued at that constant.
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
// ALL 96 patterns. A DRILLABLE pattern — one `isProducible` says can carry a
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
import { primaryHost } from "@/lib/grammar/example";
import type { LessonPosition } from "@/lib/lesson-position";
import { wordClassOf } from "@/lib/word-forms";
import { CURRICULUM_WORDS } from "@/lib/word-lesson";
import { GRAMMAR_SUBJECT, patternMeaningFactId } from "@/data/grammar";
import { RECIPES, type Host, type Level, type Recipe } from "@/data/grammar/recipes";
import { CURRICULUM_LESSONS, type GrammarLessonDef } from "@/data/grammar/lessons";
import { wordMeaningFactId, type VocabRow } from "@/data/vocab";
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

/** te-sequence -- the bare te-form -- leads the whole track: it is the
 * conjugation every other te-pattern (te-request, te-kara, te-iru...) is built
 * on, and it is the one lesson that carries an introduction (Recipe.intro), so a
 * beginner meets it as grammar lesson 1 (Sam's call). Everything else keeps its
 * level/authored order behind it. */
function teFormFirst(r: Recipe): number {
  return r.id === "te-sequence" ? 0 : 1;
}

/**
 * The patterns the track teaches, in teaching order: ALL 96 recipes, N5 before
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
    teFormFirst(a) - teFormFirst(b) || levelRank(a.level) - levelRank(b.level),
);

/**
 * How many patterns the track teaches — the denominator on the lesson card.
 * All 96 authored RECIPES.
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

/** The て/で-form — grammar lesson 1, the recipe every other te-pattern builds
 * on (see teFormFirst). Named once here so the words track, which holds a
 * る-ending verb back until this is learned, reads the id from grammar rather
 * than spelling it out itself. */
export const TE_FORM_RECIPE = "te-sequence";

/**
 * Has the learner learned the て-form yet?
 *
 * True once its meaning fact is no longer fresh — tested, claimed, or "quiz
 * me"'d — the exact "learned, not merely on screen" signal every gate in the
 * app reads. The WORDS track reads this (see nextCurriculumLock): a る-ending
 * verb's class cannot be told from its spelling, so the spine holds the first
 * one back (知る) until the て-form lesson is done and the word lesson can then
 * name the class. This is the mirror of the grammar track's own host gate —
 * there a pattern waits on a word, here a word waits on a pattern.
 */
export function teFormLearned(history: HistoryFile): boolean {
  return !isFresh(patternMeaningFactId(TE_FORM_RECIPE), history);
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
   * 96 patterns would put a span like "3–7 of 96" on a card that is really one
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

/**
 * The word type a vocab row is, in the grammar track's terms — the same four
 * hosts a recipe attaches to (see the `Host` doc in recipes.ts). Derived from
 * the conjugation class the row's JMdict tags resolve to: an adjective class is
 * an adjective host, any verb class is a verb, and everything else (nouns,
 * する-nouns, adverbs, particles) is a noun as far as a pattern is concerned.
 *
 * This is deliberately COARSER than the engine's WordClass — a pattern cares
 * whether it may attach at all (verb vs adjective vs noun), not which
 * conjugation table drives the attachment.
 */
export function wordHost(w: VocabRow): Host {
  const cls = wordClassOf(w);
  if (cls === "adj-i" || cls === "adj-ix") return "adj-i";
  if (cls === "adj-na") return "adj-na";
  if (cls) return "verb";
  return "noun";
}

/** The host a pattern must be taught on — the one its example is built on, so
 * the one the learner needs a real word of before the lesson means anything.
 * See `primaryHost`. */
function requiredHost(r: Recipe): Host | null {
  return primaryHost(r);
}

/**
 * The word types the learner has actually COMPLETED — a word of that host whose
 * lesson was finished or explicitly claimed. Both actions write a claim for the
 * word's meaning. A `seen` marker does not count: Start writes that immediately
 * so the open lesson can resume, before the learner has learned anything.
 * 〜てから therefore needs a completed VERB behind it, and 〜ので a completed
 * な-adjective, before the pattern has anything to stand on.
 *
 * Scans the words curriculum (the only words the app teaches) and stops early
 * once all four hosts are accounted for.
 */
export function learnedHosts(history: HistoryFile): Set<Host> {
  const hosts = new Set<Host>();
  for (const w of CURRICULUM_WORDS) {
    if (!history.claims?.[wordMeaningFactId(w.keb)]) continue;
    hosts.add(wordHost(w));
    if (hosts.size >= 4) break;
  }
  return hosts;
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

/** The host the lesson's primary pattern must be taught on, or null when it
 * needs none. */
function lessonHost(lesson: GrammarLessonDef): Host | null {
  const recipe = RECIPE_BY_ID.get(lesson.primaryPattern);
  return recipe ? requiredHost(recipe) : null;
}

// ---------------------------------------------------------------------------
// SITTINGS: how the 96 lessons are grouped into what a learner meets at once.
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
// FIRST user only: 〜てcause redundantly re-renders a て build table, but て was
// introduced back at lesson 1, so te-cause is NOT a form lesson and bundles like
// any other ending. 〜ている is likewise a normal bundled pattern: it sits at the
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
  return FORM_LESSON_IDS.has(lesson.id);
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
 * ("lesson N of X"). Counts SITTINGS, not the 96 patterns: a form lesson is one
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
 * THE HOST GATE. A pattern needs a real word of the type it attaches to (see
 * `requiredHost`). The gate is applied PER LESSON as the sitting is built:
 *   - If the first (teachable) lesson of the sitting is host-locked, the whole
 *     lesson is LOCKED and this returns null — the caller shows the locked card
 *     (nextGrammarLock) instead, exactly as before.
 *   - If a LATER lesson in a pattern bundle needs a host not yet met, the bundle
 *     simply stops before it. A not-yet-reached pattern must not lock the ones
 *     ahead of it in the same sitting; the learner still gets the teachable head
 *     of the bundle, and the blocked pattern becomes the head of a future
 *     sitting where its own lock (if still unmet) applies.
 *
 * Null also means the curriculum is finished (no fresh patterns left). Either
 * way there is no teachable lesson, and the card falls back to lock or nothing.
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
  const learned = learnedHosts(history);

  // Build the sitting from its still-fresh lessons at or after the teachable
  // head, applying the host gate per lesson.
  const chosen: GrammarLessonDef[] = [];
  for (const idx of members) {
    if (idx < startIndex) continue; // earlier members are already met, behind us
    const lesson = CURRICULUM_LESSONS[idx];
    if (!isFresh(patternMeaningFactId(lesson.primaryPattern), history)) continue;
    const host = lessonHost(lesson);
    if (host !== null && !learned.has(host)) {
      if (chosen.length === 0) return null; // head is host-locked: lock the card
      break; // a later bundle member is blocked: stop before it, keep the head
    }
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

/** The locked grammar card's data: which word types the next set still needs. */
export interface GrammarLock {
  /** The hosts the next set requires that the learner has not met yet, in
   * HOST_ORDER, deduped. Empty is impossible — a lock with nothing missing is
   * not a lock, and nextGrammarLock returns null for that. */
  hosts: Host[];
}

/**
 * The lock on the next grammar set, or null when it is teachable (or there is
 * nothing next). The mirror of nextWordLock: same next set, and it reports what
 * is standing in the way rather than what to teach.
 */
export function nextGrammarLock(
  history: HistoryFile,
  _count?: number,
): GrammarLock | null {
  const next = nextLessonAt(history);
  if (!next) return null;

  const host = lessonHost(next.lesson);
  if (host === null || learnedHosts(history).has(host)) return null;
  return { hosts: [host] };
}

/** The subject these lessons belong to. Re-exported so a caller holding a
 * lesson never has to reach into the data file to name it. */
export { GRAMMAR_SUBJECT };

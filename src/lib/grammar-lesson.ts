// The grammar track: the fourth curriculum, and the one whose "how many are
// there" the data refuses to answer on purpose (see src/data/grammar/recipes.ts).
//
// That refusal is about JAPANESE and it stands. This file still publishes a
// GRAMMAR_CURRICULUM_TOTAL, because "how many patterns does this track teach"
// is a question about the app rather than the subject — the distinction, and
// why the answer is the 56 drillable recipes and not the 96 authored ones, is
// argued at that constant.
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
// WHAT THE TRACK TEACHES, AND WHAT IT LEAVES ON THE CLUSTER PAGE
// =============================================================
// Only DRILLABLE patterns — the ones `isProducible` says can carry a production
// question with ONE answer. A reference-only pattern (a wrap like 〜しか〜ない,
// or a vacuous one like 〜は〜より whose "production" is just retyping) is real
// grammar and worth SHOWING, but it is not a lesson: it lives in the cluster map
// (clusters.ts), shown and never asked. A lesson card that taught a pattern the
// drill will forever refuse to quiz would be a lesson with no second half — the
// same reason data/grammar/index.ts mints no production fact for those rows.
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
// right after kana) wants the easier half first. So the teaching order is the
// drillable recipes sorted N5-before-N4, STABLY — which preserves the authored
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
import { DRILLABLE, RECIPES, type Host, type Level, type Recipe } from "@/data/grammar/recipes";
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
 * The patterns the track teaches, in teaching order: the drillable recipes,
 * N5 before N4, stable within a level.
 *
 * Computed once — it is a property of the data, not of the user. `DRILLABLE` is
 * already `RECIPES.filter(isProducible)` in authored order; the stable sort
 * lifts every N5 ahead of every N4 without disturbing the functional grouping
 * inside each level (Array.prototype.sort is stable).
 */
export const CURRICULUM_PATTERNS: readonly Recipe[] = [...DRILLABLE].sort(
  (a, b) =>
    teFormFirst(a) - teFormFirst(b) || levelRank(a.level) - levelRank(b.level),
);

/**
 * How many patterns the track teaches — the denominator on the lesson card.
 * 56 (DRILLABLE), out of 96 authored RECIPES.
 *
 * WHY THE DRILLABLE COUNT AND NOT THE WHOLE TABLE
 * ===============================================
 * The 40 non-drillable recipes are real grammar and are really shown — the
 * cluster map prints them, and a learner will read them. They are still not the
 * denominator, because a denominator is a promise about the TRACK: "keep going
 * and you will have met all of these". This track never teaches those 40 and,
 * by construction, never can — data/grammar/index.ts mints no production fact
 * for them, so a lesson card holding one would be a lesson the drill would
 * forever refuse to quiz. 96 would promise 40 lessons that cannot exist. It is
 * the same error as counting the 6,340 advanced words the words track declines
 * to push: material the app HAS is not material the app TEACHES.
 *
 * AND THE HEADER OF recipes.ts IS NOT AN OBJECTION TO THIS
 * =======================================================
 * That file argues at length that "how many grammar points are there" has no
 * answer — vendors count N5 at 40, 84, 125 or 132, and the JLPT withdrew its
 * own list. All true, and it is a question about JAPANESE. This is a different
 * question with a different subject: how many patterns does THIS app's grammar
 * track teach? That one has an answer, because we authored the table and we
 * decide what is drillable. Printing 56 claims nothing about the language; it
 * claims something about the app, which is exactly the kind of claim a progress
 * counter is allowed to make. Counting the authored 96 would blur the two back
 * together by implying the table is a census of the subject.
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
   * Where you are, in PATTERNS — "3–7 of 56".
   *
   * The card used to say "lesson 3" and stop there, and the comment that stood
   * here defended it: the curriculum's length is fixed but a total "would read
   * as a promise". It reads as a promise because it IS one — the mistake was
   * making the promise about lessons, which the app cannot keep, rather than
   * about patterns, which it can. 56 is the whole of what this track will ever
   * teach and it does not move; see GRAMMAR_CURRICULUM_TOTAL.
   *
   * ITEMS ARE PATTERNS. Not lessons, and not sentences either — a pattern is
   * what a card teaches and what a fact hangs off, so it is the only unit whose
   * count means anything to the person reading it.
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

/**
 * The next grammar lesson, or null when there is nothing teachable to hand out.
 *
 * Walk the curriculum in teaching order and take the next `count` patterns whose
 * MEANING fact is still fresh. A met pattern is skipped and counted, the same
 * signal the words track uses.
 *
 * THE HOST GATE. Unlike before, a pattern DOES have a prerequisite: the learner
 * needs a real word of the type it attaches to (see `requiredHost`). If any
 * pattern in the next set needs a host the learner has not met, the lesson is
 * LOCKED and this returns null — the caller then shows the locked card
 * (nextGrammarLock) instead, exactly as the words track locks a set behind its
 * kanji.
 *
 * Null also means the curriculum is finished (no fresh patterns left). Either
 * way there is no teachable lesson, and the card falls back to lock or nothing.
 *
 * PURE OF KANA. Like the other tracks, this does not know whether kana is done;
 * that gate is the caller's (see src/app/page.tsx).
 */
export function nextGrammarLesson(
  history: HistoryFile,
  // Kept for call-site compatibility; a sitting is now one whole lesson, so
  // there is no per-sitting size to apply.
  _count?: number,
): GrammarLesson | null {
  const next = nextLessonAt(history);
  if (!next) return null;
  const { lesson, index } = next;

  const host = lessonHost(lesson);
  if (host !== null && !learnedHosts(history).has(host)) return null;

  const recipe = RECIPE_BY_ID.get(lesson.primaryPattern);
  return {
    cards: recipe ? [toCard(recipe)] : [],
    facts: [...lesson.drills],
    position: {
      from: index + 1,
      to: index + 1,
      total: CURRICULUM_LESSONS.length,
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

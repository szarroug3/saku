// The grammar track: the fourth curriculum, and the one whose "how many are
// there" the data refuses to answer on purpose (see src/data/grammar/recipes.ts).
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
import { factsOf } from "@/lib/facts";
import {
  GRAMMAR_SUBJECT,
  patternEntry,
  patternMeaningFactId,
} from "@/data/grammar";
import { DRILLABLE, type Level, type Recipe } from "@/data/grammar/recipes";
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

/** N5 before N4. The one axis the teaching order sorts on; everything else is
 * left to the authored (stable) order. */
function levelRank(level: Level): number {
  return level === "N5" ? 0 : 1;
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
  (a, b) => levelRank(a.level) - levelRank(b.level),
);

/** Every fact a pattern teaches — its meaning always, its production where the
 * recipe carries one. Read off the registry (factsOf) rather than rebuilt, so
 * a drillable recipe whose example doesn't build contributes only the facts
 * that actually exist, and the lesson can never seed a fact the drill can't
 * render. Lookup, not parse — the same rule facts.ts is built on. */
function patternFacts(r: Recipe): FactId[] {
  return factsOf(patternEntry(r.id));
}

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
  /** The terse functional gloss. "after doing X" */
  gloss: string;
  /** N5 or N4, for a quiet level tag on the card. */
  level: Level;
}

/** The next grammar lesson: the patterns to teach, their facts, and where you
 * are. Mirrors WordLesson — no honest TOTAL, because a "lesson N of M" is a
 * promise, and the count of teachable patterns is fixed but the card counts up
 * rather than lie about an end the user can't see coming. */
export interface GrammarLesson {
  cards: GrammarCard[];
  facts: FactId[];
  /** How many patterns you have already met — so the card can say "lesson N"
   * without a stored cursor. */
  index: number;
}

function toCard(r: Recipe): GrammarCard {
  return { id: r.id, pattern: r.pattern, gloss: r.gloss, level: r.level };
}

/**
 * The next grammar lesson, or null when there is nothing new to teach.
 *
 * Walk the curriculum in teaching order and take the next `count` patterns whose
 * MEANING fact is still fresh — "met" is the meaning being non-fresh, the same
 * signal the words track uses, because meeting a pattern is being shown what it
 * means (its production is the drill's job, not the lesson's). A met pattern is
 * skipped and counted; there is no gate to step over the way a kanji word waits
 * on its kanji, because a pattern has no prerequisite of its own.
 *
 * Null is a real state, not an error: it means the curriculum is finished, and
 * the card is then not rendered — the same rule every other lesson card follows.
 *
 * PURE OF KANA. Like nextKanjiLesson and nextWordLesson, this does not know
 * whether kana is done. That gate is the caller's (see src/app/page.tsx, which
 * opens grammar on the same `lesson === null` condition as kanji), so a beginner
 * is never handed grammar before finishing the first front.
 */
export function nextGrammarLesson(
  history: HistoryFile,
  count: number,
): GrammarLesson | null {
  const size = clampGrammarPerLesson(count);
  const cards: GrammarCard[] = [];
  const facts: FactId[] = [];
  let met = 0;

  for (const r of CURRICULUM_PATTERNS) {
    if (!isFresh(patternMeaningFactId(r.id), history)) {
      met++;
      continue;
    }
    cards.push(toCard(r));
    facts.push(...patternFacts(r));
    if (cards.length >= size) break;
  }

  if (!cards.length) return null;
  return { cards, facts, index: Math.floor(met / size) + 1 };
}

/** The subject these lessons belong to. Re-exported so a caller holding a
 * lesson never has to reach into the data file to name it. */
export { GRAMMAR_SUBJECT };

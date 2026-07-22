// The numbers-and-counters track's scheduler — the words track's twin, over the
// counters curriculum instead of VOCAB.
//
// WHY IT IS NOT word-lesson.ts
// ============================
// A counter is a `word` fact (COUNTERS_SUBJECT), so it drills and scores exactly
// like vocabulary — but it is NOT in VOCAB (the counting words this track
// teaches first are absent from the generated dictionary; see counters.ts), so
// the words scheduler cannot reach it. This file walks COUNTER_CURRICULUM the
// same way word-lesson.ts walks CURRICULUM_WORDS: a PURE function of history,
// no cursor, the next handful of fresh, teachable forms in teaching order.
//
// THE GATE, PHASE BY PHASE
// ========================
// Phase 1 (〜つ, the Sino numbers, 〜人, 11-99/百千万) is all kana, so
// counterKanjiPrereqs returns [] and every phase-1 form is teachable the moment
// the track opens, right after hiragana. Phase 2 (〜本/〜匹/〜枚) is written with
// a NUMBER kanji, so it gates on that kanji being known: 三本 waits until 三 is
// learned. Phase 3 (the tail) is written with kanji too and gates the same way.
// The gate is `counterTeachable`, and it is `counterKanjiPrereqs` checked
// against `kanjiKnown` — the identical prerequisite the words track applies to a
// kanji word's kanji.
//
// IT INTERLEAVES, IT DOES NOT LOCK
// ================================
// A form whose number kanji is not yet known is STEPPED OVER, not turned into a
// lock card — the transitivity track's model, not the words track's. The number
// kanji (一..十) are among the very first kanji taught, so phase 2 opens almost
// as soon as the kanji track does, and a lock card naming "learn 三" would flash
// and vanish within a lesson or two. So the card is either teaching the next
// ready forms or absent, and a learner with no counters history sees exactly
// what they saw before this file existed: nothing, until the track opens.

import { effectiveState } from "@/lib/claims";
import { factsOf } from "@/lib/facts";
import { kanjiKnown } from "@/lib/kanji-known";
import type { LessonPosition } from "@/lib/lesson-position";
import {
  COUNTERS_SUBJECT,
  COUNTER_CURRICULUM,
  counterEntry,
  counterKanjiPrereqs,
  counterMeaningFactId,
  isKanaForm,
  type CounterForm,
} from "@/data/counters";
import type { FactId, HistoryFile } from "@/types";

/**
 * How many counters a lesson teaches. A COUNT, not a cost — a counter is a word,
 * uniform and indivisible, so the honest unit is how many you meet in a sitting,
 * the same call the words and grammar tracks make. There is deliberately no
 * Settings knob for it; the caller may pass a size but the app never asks the
 * user to set one.
 */
export const COUNTERS_PER_LESSON_DEFAULT = 5;

/** Clamp a passed count to a sane lesson size — whole, at least 1, capped so a
 * hand-edit can't ask for a 100-item teach screen. Same instinct as
 * clampWordsPerLesson and clampGrammarPerLesson. */
export function clampCountersPerLesson(n: number): number {
  const v = Math.round(Number.isFinite(n) ? n : COUNTERS_PER_LESSON_DEFAULT);
  return Math.min(20, Math.max(1, v));
}

/** The forms the track teaches, in teaching order. It IS COUNTER_CURRICULUM —
 * the sequence is authored there (〜つ first, then the numbers, then the
 * counters built on them, then the tail) — re-exported so a consumer names it
 * without reaching into the data file. */
export const CURRICULUM_COUNTERS: readonly CounterForm[] = COUNTER_CURRICULUM;

/** How many counters the track teaches — the denominator on the lesson card. */
export const COUNTERS_CURRICULUM_TOTAL = CURRICULUM_COUNTERS.length;

/** The facts a counter teaches — its meaning always, its reading unless it is a
 * kana form (whose reading is the glyph itself, so there is no reading fact; see
 * buildCounterFacts). Read off the registry, never rebuilt, so the lesson can
 * only seed facts that actually exist. */
function counterFacts(form: CounterForm): FactId[] {
  return factsOf(counterEntry(form));
}

/** A fact the app has no record of — never answered, never claimed, never
 * "quiz me"'d. The one definition of "new", the same `lastTested === 0` rule the
 * words and grammar tracks read per fact. */
function isFresh(fact: FactId, history: HistoryFile): boolean {
  const state = effectiveState(
    history.facts[fact],
    history.claims?.[fact],
    history.seen?.[fact],
  );
  return state.lastTested === 0;
}

/**
 * Is this counter teachable right now? A kana form (all of phase 1) always is;
 * a counted form is teachable only once its NUMBER kanji is known. This is the
 * approved gate: phase 1 needs kana alone (counterKanjiPrereqs is []), phase 2
 * and the tail need their number kanji learned — 三本 waits on 三.
 */
export function counterTeachable(form: CounterForm, history: HistoryFile): boolean {
  return counterKanjiPrereqs(form).every((c) => kanjiKnown(c, history));
}

/** Has the learner met any counter at all? The words track's
 * `hasStartedWordTrack`, for counters — used to decide whether a returning
 * learner has opened the track. */
export function hasStartedCountersTrack(history: HistoryFile): boolean {
  for (const f of CURRICULUM_COUNTERS) {
    if (!isFresh(counterMeaningFactId(f), history)) return true;
  }
  return false;
}

/** One counter, ready to render on a lesson card. */
export interface CounterCard {
  /** How it looks — ひとつ, 三本. */
  glyph: string;
  /** Its reading, or null for a kana form (whose reading is the glyph itself, so
   * printing ひとつ · ひとつ would read as a bug). */
  reading: string | null;
  /** The plain-language gloss — "three long objects". */
  meaning: string;
  /** Which counter this is a form of, for a quiet tag; "" for a bare number. */
  counter: string;
}

/** The next counters lesson: the forms to teach, their facts, and where you
 * are. */
export interface CounterLesson {
  cards: CounterCard[];
  facts: FactId[];
  /** Where you are, in COUNTERS — "6-10 of 87". Items are counters, counted the
   * way the words and grammar tracks count theirs; see lesson-position.ts. */
  position: LessonPosition;
}

function toCard(form: CounterForm): CounterCard {
  return {
    glyph: form.glyph,
    reading: isKanaForm(form) ? null : form.reading,
    meaning: form.meaning,
    counter: form.counter,
  };
}

/** The next `size` fresh AND teachable counters, in teaching order. A met form
 * is skipped; a gated one (its number kanji not yet known) is stepped over and
 * picked up later, when the kanji track has paid for it — the interleaving the
 * file header describes. */
function nextCounterSet(history: HistoryFile, count: number): CounterForm[] {
  const size = clampCountersPerLesson(count);
  const rows: CounterForm[] = [];
  for (const f of CURRICULUM_COUNTERS) {
    if (!isFresh(counterMeaningFactId(f), history)) continue;
    if (!counterTeachable(f, history)) continue;
    rows.push(f);
    if (rows.length >= size) break;
  }
  return rows;
}

/**
 * The next counters lesson, or null when nothing is teachable yet.
 *
 * Walk the curriculum in teaching order and take the next `count` forms that are
 * new (meaning not yet met) and teachable now (kana, or number kanji known).
 * Null is a real state, not an error, and it means one of two things the card
 * need not tell apart: the curriculum is finished, or the next forms are all
 * still gated behind kanji not yet learned. Either way nothing is shown, the
 * same rule every other track's card follows.
 *
 * PURE OF KANA. Like the other post-kana tracks, this does not know whether kana
 * is done; that gate is the caller's (see src/app/page.tsx).
 */
export function nextCounterLesson(
  history: HistoryFile,
  count: number,
): CounterLesson | null {
  const rows = nextCounterSet(history, count);
  if (!rows.length) return null;

  // How many counters have been met, counted over the WHOLE curriculum rather
  // than positionally from the front — the track skips gated forms, so its met
  // set is not a contiguous run and "you have learned N" is the only honest
  // count. The next forms are all fresh, so they are never in this total.
  const met = CURRICULUM_COUNTERS.filter(
    (f) => !isFresh(counterMeaningFactId(f), history),
  ).length;

  const cards = rows.map(toCard);
  const facts = rows.flatMap(counterFacts);
  return {
    cards,
    facts,
    position: {
      from: met + 1,
      to: met + cards.length,
      total: COUNTERS_CURRICULUM_TOTAL,
    },
  };
}

/** The subject these lessons belong to. Re-exported so a caller holding a lesson
 * never has to reach into the data file to name it. It is `word` — a counter is
 * vocabulary with a track label. */
export { COUNTERS_SUBJECT };

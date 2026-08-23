// UNIT TRACKS — every track the app teaches, at the UNIT grain the scheduler runs
// on. A track answers one question: "in what order are my teaching units met?"
// The shared unit scheduler (unit-scheduler.ts) does the rest — dueness, cost,
// prerequisites, budget, depth gate — uniformly over the base `TeachingUnit`.
//
// ORDER IS PER-TRACK, and it lives at different grains:
//   - The PRONUNCIATION (vocab) track orders at the UNIT grain: readings across
//     glyphs interleave by how often each is spoken (`orderedUnits`). A word's
//     units can be split across the sequence by frequency.
//   - Every other track orders at the ITEM grain: its items in curriculum/data
//     order, each expanded to its units in place (`teachUnitsOf`). One unit per
//     item for keigo/grammar/verb-pair; one per kana; the number track's mix.
//
// This is the registry the scheduling dev view iterates, including the sentence
// units whose additional history-dependent gate is applied by the /learn index.

import { CURRICULUM_SEQUENCE } from "@/lib/curriculum-sequence";
import { VOCAB_FACTS } from "@/data/vocab";
import { emptyHistory, applyClaims } from "@/lib/history-ops";
import { orderedUnits, teachUnitsOf, isUnitDue } from "./teach-unit";
import { kanaItems } from "./kana-unit";
import { keigoItems } from "./keigo-unit";
import { grammarItems } from "./grammar-unit";
import { transitivityItems } from "./verb-pair-unit";
import { numbersTrack } from "./numbers-track";
import { sentenceItems } from "./sentence-track";
import { nextTrackLesson } from "./unit-scheduler";
import type { TeachingUnit, UnitLesson } from "./teach-unit";
import type { LessonRange } from "@/lib/lesson-sizing";
import type { FactId, HistoryFile } from "@/types";

/** A track at the unit grain: a title and its full teaching sequence of units, in
 * teaching order. History is accepted for symmetry with the item Track (a track
 * MAY drop what's learned), but every track here orders statically — the
 * scheduler filters dueness — so today none reads it. */
export interface UnitTrack {
  readonly id: string;
  readonly title: string;
  units(history: HistoryFile): readonly TeachingUnit[];
  /** A starting history in which this track's BLOCKING prerequisites are already
   * learned — the state a track that rides on another (transitivity on vocab)
   * needs to schedule anything at all. Absent for a self-contained track, which
   * starts from empty. */
  seed?(): HistoryFile;
}

/** A history with every vocabulary word learned — the seed a vocab-gated track
 * (transitivity) is simulated against, so a pair whose verbs are taught unblocks
 * and a pair whose verbs the curriculum never teaches stays hidden. */
function vocabLearned(): HistoryFile {
  return applyClaims(
    emptyHistory(),
    VOCAB_FACTS.map((f) => f.id),
    1,
  );
}

/** The vocab/pronunciation spine, unit-ordered by spoken frequency across every
 * curriculum glyph — the one track whose order is finer than its items.
 *
 * DEDUPED (SAK-162): CURRICULUM_SEQUENCE can now repeat a glyph — a word taught
 * with more than one reading (七) occupies more than one item, one per reading
 * (see curriculum-order.ts's header) — but `orderedUnits` already expands ONE
 * glyph into ALL of its pronunciation units (`pronunciationUnitsOf`), every
 * reading included. Feeding it the same glyph twice would build and re-sort the
 * same units twice, duplicating every multi-reading word's units on this track.
 * A `Set` restores the one-call-per-glyph shape `.map` alone used to guarantee
 * back when CURRICULUM_SEQUENCE never repeated a glyph at all. */
function vocabUnits(): readonly TeachingUnit[] {
  return orderedUnits(new Set(CURRICULUM_SEQUENCE.map((i) => i.glyph)));
}

/** Every track, in the order the app introduces them. */
export const UNIT_TRACKS: readonly UnitTrack[] = [
  { id: "kana", title: "Kana", units: () => kanaItems().flatMap(teachUnitsOf) },
  { id: "vocab", title: "Vocabulary", units: () => vocabUnits() },
  { id: "numbers", title: "Numbers & counters", units: (h) => numbersTrack().order(h).flatMap(teachUnitsOf) },
  { id: "keigo", title: "Keigo", units: () => keigoItems().flatMap(teachUnitsOf) },
  { id: "grammar", title: "Grammar", units: () => grammarItems().flatMap(teachUnitsOf) },
  {
    id: "transitivity",
    title: "Verb pairs",
    units: () => transitivityItems().flatMap(teachUnitsOf),
    seed: vocabLearned, // pairs are blocked by their verbs — learn the vocab first
  },
  { id: "sentence", title: "Building sentences", units: () => sentenceItems().flatMap(teachUnitsOf) },
];

/** One simulated lesson: its number in the run and the units the scheduler chose
 * (prerequisites included, in teach order). */
export interface SimulatedLesson extends UnitLesson {
  readonly n: number;
}

/**
 * Drive a track forward from empty history: take a lesson, mark its units learned,
 * take the next, until the track runs dry or `maxLessons` is reached. This is the
 * scheduler's own forward walk — the same `nextTrackLesson` the app calls — so the
 * dev view shows exactly what a learner would meet, lesson by lesson, prereqs and
 * all. Pure: a fresh history is built here and threaded, nothing outside is
 * touched. `maxLessons` caps a runaway (or genuinely long) track.
 */
export function simulateLessons(
  track: UnitTrack,
  range: LessonRange,
  maxLessons: number,
): SimulatedLesson[] {
  const lessons: SimulatedLesson[] = [];
  let history = track.seed?.() ?? emptyHistory();
  let ts = 1;
  // Every track orders statically (the scheduler filters dueness against the
  // evolving history), so the order is computed once, not per lesson.
  const order = track.units(history);
  // Advance a cursor past the fully-learned leading prefix so each lesson scans
  // near the front, not the whole (growing) history — O(units), not O(lessons×units).
  let cursor = 0;
  for (let n = 1; n <= maxLessons; n++) {
    const lesson = nextTrackLesson(order, history, range, cursor);
    if (!lesson) break;
    lessons.push({ n, units: lesson.units });
    const facts = lesson.units.flatMap((u) => u.facts) as FactId[];
    history = applyClaims(history, facts, ts++);
    while (cursor < order.length && !isUnitDue(order[cursor], history)) cursor++;
  }
  return lessons;
}

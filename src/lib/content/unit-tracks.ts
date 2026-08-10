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
// This is the registry the scheduling dev view iterates, and the home for the
// tracks that had only an item enumerator before (kana, keigo, grammar,
// transitivity). `sentence-ordering` is not here yet — its facts aren't in the
// registry, so it has no units to order.

import { CURRICULUM_SEQUENCE } from "@/lib/curriculum-order";
import { emptyHistory, applyClaims } from "@/lib/history-ops";
import { orderedUnits, teachUnitsOf } from "./teach-unit";
import { kanaItems } from "./kana-unit";
import { keigoItems } from "./keigo-unit";
import { grammarItems } from "./grammar-unit";
import { transitivityItems } from "./verb-pair-unit";
import { numbersTrack } from "./numbers-track";
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
}

/** The vocab/pronunciation spine, unit-ordered by spoken frequency across every
 * curriculum glyph — the one track whose order is finer than its items. */
function vocabUnits(): readonly TeachingUnit[] {
  return orderedUnits(CURRICULUM_SEQUENCE.map((i) => i.glyph));
}

/** Every track, in the order the app introduces them. */
export const UNIT_TRACKS: readonly UnitTrack[] = [
  { id: "kana", title: "Kana", units: () => kanaItems().flatMap(teachUnitsOf) },
  { id: "vocab", title: "Vocabulary", units: () => vocabUnits() },
  { id: "numbers", title: "Numbers & counters", units: (h) => numbersTrack().order(h).flatMap(teachUnitsOf) },
  { id: "keigo", title: "Keigo", units: () => keigoItems().flatMap(teachUnitsOf) },
  { id: "grammar", title: "Grammar", units: () => grammarItems().flatMap(teachUnitsOf) },
  { id: "transitivity", title: "Verb pairs", units: () => transitivityItems().flatMap(teachUnitsOf) },
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
  let history = emptyHistory();
  let ts = 1;
  for (let n = 1; n <= maxLessons; n++) {
    const order = track.units(history);
    const lesson = nextTrackLesson(order, history, range);
    if (!lesson) break;
    lessons.push({ n, units: lesson.units });
    const facts = lesson.units.flatMap((u) => u.facts) as FactId[];
    history = applyClaims(history, facts, ts++);
  }
  return lessons;
}

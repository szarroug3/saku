// The ONE scheduler — every track shares it. It never re-implements per-track
// logic; it walks the prerequisite DAG (edges live on each ContentItem, see
// item.ts) and fills a lesson budget. This is what collapses ~8 hand-rolled
// `nextXLesson` functions into one, and where the ordering bugs (a rule card
// reachable before its prereqs; 10+ taught before 5) stop being possible.
//
// ALGORITHM (Stage 3 implements; the contract is fixed here):
//   1. Walk the active track's order (Track.order) for the next UNKNOWN items.
//   2. For each, gather its UNTAUGHT prerequisites transitively — from ANY track;
//      a number freely pulls a non-number kanji owned by the word track, and the
//      scheduler teaches it here regardless of which track "owns" it.
//   3. Emit items in dependency order, each preceded by its untaught prereqs,
//      until the LessonRange budget is full (always at least one item).
//   4. DEPTH GATE: defer an item whose untaught-prereq chain is deeper than
//      MAX_PREREQ_DEPTH — too much cascade to teach in one sitting. It resurfaces
//      once its deep prereqs are learned (on their own, or in earlier lessons)
//      and the chain is shallow enough. This one rule replaces the counters
//      track's prepOnly/marker machinery.
//
// Stage 0 of docs/architecture-refactor.md: the contract and the gate constant.
// Additive, not yet consumed.

import type { EntryId, HistoryFile } from "@/types";
import type { LessonRange } from "@/lib/lesson-sizing";
import type { ContentItem } from "./item";
import type { Track } from "./track";

/**
 * The deepest chain of UNTAUGHT prerequisites the scheduler will teach at once.
 * A>B>C>D>E with nothing known is too much cascade for one lesson, so the item
 * requesting it is deferred until enough of the chain is learned that the
 * remaining depth is within this bound.
 */
export const MAX_PREREQ_DEPTH = 3;

/** One lesson: items to teach in dependency order (each prereq before the item
 * that needs it). The shared viewport renders them, and preview / HUD / resume
 * read this SAME array, so none of them can disagree with what is taught. */
export interface Lesson {
  readonly items: readonly ContentItem[];
}

/**
 * The single scheduler. A track supplies only its order; `resolve` maps an entry
 * to its item so cross-track prerequisites can be looked up. A PURE function of
 * history — the resume position is derived from the same walk, never re-computed
 * elsewhere.
 */
export type NextLesson = (
  track: Track,
  resolve: (entry: EntryId) => ContentItem | undefined,
  history: HistoryFile,
  range: LessonRange,
) => Lesson | null;

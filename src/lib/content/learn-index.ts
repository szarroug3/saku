// NO `import "server-only"` YET: it hard-breaks `next build` while
// src/lib/library/library-index.ts still imports CURRICULUM_GLYPHS from this
// file at module scope, and library-index.ts is itself still reachable from a
// client bundle (src/lib/library/href.ts, imported directly by
// src/components/lists/manage-lists.tsx — see both files' own "NO server-only
// YET" headers). Next's server-only check has no partial-success mode: as long
// as ANY unguarded module sits between this one and a client component, adding
// the guard here breaks every route reachable from that component, not just
// /learn. Re-add once library-index.ts's own straggler (manage-lists.tsx) is
// migrated to a Server Action too — tracked separately from SAK-115, which
// only covers this file's home-feed.tsx/current-sessions.tsx consumers (both
// now resolved: home-feed.tsx and current-sessions.tsx no longer import this
// file directly — see learn-scheduler.ts and getLearnIndexData in
// server-lookups.ts).

// LEARN INDEX LOADER — the content-free frontier for /learn.
//
// Reads the precomputed index (learn-index.json) and runs the SAME scheduler core
// (unit-scheduler-core.ts) the content path runs, binding its three touch-points
// to the index instead of the dictionary. Importing this pulls the ~1.4 MB index,
// NOT the ~8.6 MB curriculum content: no vocab.ts, no kanji.ts, no facts.ts.
//
// The frontier this computes is asserted byte-for-byte equal to the live one by
// learn-index.equiv.test.ts — that test, not this module, is the safety net.
//
// THE FUNCTIONS BELOW ARE THIN BINDERS. The actual walk (nextLearnLesson,
// nextSentenceLearnLesson, startedLearnTracks, …) lives in learn-scheduler.ts as
// plain functions parameterized over an index snapshot instead of closing over
// module-scope `INDEX` — that is what lets a CLIENT component run the exact same
// walk against a fetched-once snapshot (getLearnIndexData, server-lookups.ts)
// without either re-importing this guarded-eventually module or paying a round
// trip per history change. Every export here just supplies `INDEX` as that
// snapshot, so every existing server-side/test caller keeps its old
// zero-index-argument call shape.

import indexJson from "@/data/generated/learn-index.json" with { type: "json" };
import type { UnitLessonOf } from "./unit-scheduler-core";
import type { IndexUnit, LearnIndex } from "./learn-index-types";
import type { LessonRange } from "@/lib/lesson-sizing";
import type { EntryId, FactId, HistoryFile } from "@/types";
import * as scheduler from "./learn-scheduler";

const INDEX = indexJson as unknown as LearnIndex;

/** A /learn track: its display id/title and its precomputed, statically-ordered
 * teaching units. `units` replaces the content path's `track.units(history)` —
 * units are history-independent, so the precomputed array is the order for any
 * history. */
export interface LearnTrack {
  readonly id: string;
  readonly title: string;
  readonly units: readonly IndexUnit[];
}

/** Every track /learn schedules, in introduction order — the precomputed twin of
 * UNIT_TRACKS, carrying no content. */
export const LEARN_TRACKS: readonly LearnTrack[] = INDEX.tracks;

/** The content hash of the index (Phase 3 frontier cache key). */
export const CURRICULUM_VERSION: string = INDEX.curriculumVersion;

/** Every curriculum glyph in prereq-respecting spine order. UNUSED today, and
 * UNSAFE to use for a per-lesson position span — see the long comment on
 * `curriculumGlyphs` in learn-index-types.ts before reaching for this. */
export const CURRICULUM_GLYPHS: readonly string[] = INDEX.curriculumGlyphs;

/** The whole precomputed index, for a caller that needs to run the
 * learn-scheduler.ts walk itself (server-lookups.ts's getLearnIndexData, which
 * hands this to a client component as one fetched-once snapshot). */
export function learnIndexSnapshot(): LearnIndex {
  return INDEX;
}

/** The next lesson for a /learn track's precomputed units, wired to history — the
 * content-free twin of `nextTrackLesson`. A pure function of history. */
export function nextLearnLesson(
  units: readonly IndexUnit[],
  history: HistoryFile,
  range: LessonRange,
  start: number = 0,
): UnitLessonOf<IndexUnit> | null {
  return scheduler.nextLearnLesson(units, history, range, INDEX, start);
}

/** The next sentence tier admitted by the original planner's linear pool-size +
 * grammar gate, evaluated entirely from precomputed fact ids. */
export function nextSentenceTierId(history: HistoryFile): string | null {
  return scheduler.nextSentenceTierId(INDEX, history);
}

/** The gated sentence lesson. Sentence completion is session-aware rather than
 * ordinary fact freshness, so select the admitted tier directly instead of
 * asking the generic scheduler to infer it from the marker alone. */
export function nextSentenceLearnLesson(
  units: readonly IndexUnit[],
  history: HistoryFile,
): UnitLessonOf<IndexUnit> | null {
  return scheduler.nextSentenceLearnLesson(units, history, INDEX);
}

/** Rebuild the exact sentence tier carried by an open run. Unlike the generic
 * resume mask, this remains stable after assembly answers have entered history
 * and when the run's grammar facts are themselves part of the admission gate. */
export function sentenceLearnLessonForRun(
  units: readonly IndexUnit[],
  facts: readonly FactId[],
): UnitLessonOf<IndexUnit> | null {
  return scheduler.sentenceLearnLessonForRun(units, facts, INDEX);
}

/** Resolve a sentence lesson entry back to its tier without parsing opaque ids. */
export function sentenceTierIdOfEntry(entry: EntryId): string | null {
  return scheduler.sentenceTierIdOfEntry(entry, INDEX);
}

const TRACK_ID_OF_FACT: ReadonlyMap<FactId, string> = scheduler.trackIdOfFactMap(
  INDEX.tracks,
);

/** The /learn track id that teaches a fact, or undefined for a fact the index
 * doesn't carry (a readable sentence-ordering drill fact, a fact from deleted
 * content). */
export function trackIdOfFact(fact: FactId): string | undefined {
  return scheduler.trackIdOfFact(fact, TRACK_ID_OF_FACT);
}

/**
 * Every /learn track (see LEARN_TRACKS) the learner has already touched,
 * ignoring the facts of the lesson about to be taught: the SAK-28 "track intro"
 * card-0 gate. See learn-scheduler.ts's `startedLearnTracks` for the full
 * rationale (moved there verbatim; this just supplies the module's own
 * TRACK_ID_OF_FACT map).
 */
export function startedLearnTracks(
  history: HistoryFile,
  exclude: ReadonlySet<FactId>,
): Set<string> {
  return scheduler.startedLearnTracks(history, exclude, TRACK_ID_OF_FACT);
}

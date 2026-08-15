// LEARN INDEX LOADER — the content-free frontier for /learn.
//
// Reads the precomputed index (learn-index.json) and runs the SAME scheduler core
// (unit-scheduler-core.ts) the content path runs, binding its three touch-points
// to the index instead of the dictionary. Importing this pulls the ~1.4 MB index,
// NOT the ~8.6 MB curriculum content: no vocab.ts, no kanji.ts, no facts.ts.
//
// The frontier this computes is asserted byte-for-byte equal to the live one by
// learn-index.equiv.test.ts — that test, not this module, is the safety net.

import indexJson from "@/data/generated/learn-index.json" with { type: "json" };
import {
  isFactFresh,
  nextTrackLessonCore,
  type SchedulerDeps,
  type UnitLessonOf,
} from "./unit-scheduler-core";
import type { IndexUnit, LearnIndex } from "./learn-index-types";
import type { LessonRange } from "@/lib/lesson-sizing";
import type { EntryId, FactId, HistoryFile } from "@/types";
import { effectiveState } from "@/lib/claims";
import {
  sentenceTierDone,
  sentenceTierMarkerFact,
} from "@/lib/sentence-ordering-progress";

const INDEX = indexJson as unknown as LearnIndex;

/** The precomputed deps: every touch-point the walk needs, served from the index.
 * Each mirrors its content-backed twin in unit-scheduler.ts exactly. */
const LEARN_DEPS: SchedulerDeps<IndexUnit> = {
  isFactFresh,
  // Mirrors contentResolvePrereq: a node exists only where the content path
  // resolved a primary unit, so an absent (or unit-less) node → undefined → skip.
  resolvePrereq(entry: EntryId) {
    const node = INDEX.resolve[entry as unknown as string];
    if (!node || !node.unit) return undefined;
    return { glyph: node.glyph, prereqs: node.prereqs, unit: node.unit };
  },
  // Mirrors isLearned: facts present and all claimed. An entry with no facts (not
  // in the map) is never learned, so a blocking edge onto it never lifts.
  isLearned(entry: EntryId, history: HistoryFile) {
    const facts = INDEX.blockerFacts[entry as unknown as string] ?? [];
    return facts.length > 0 && facts.every((f) => !isFactFresh(f, history));
  },
};

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

/** Every curriculum glyph in prereq-respecting spine order — the vocab card's
 * position denominator (home-feed's vocabPositionLabel). */
export const CURRICULUM_GLYPHS: readonly string[] = INDEX.curriculumGlyphs;

/** The next lesson for a /learn track's precomputed units, wired to history — the
 * content-free twin of `nextTrackLesson`. A pure function of history. */
export function nextLearnLesson(
  units: readonly IndexUnit[],
  history: HistoryFile,
  range: LessonRange,
  start: number = 0,
): UnitLessonOf<IndexUnit> | null {
  return nextTrackLessonCore(units, history, range, LEARN_DEPS, start);
}

function factKnown(fact: FactId, history: HistoryFile): boolean {
  return (
    effectiveState(
      history.facts[fact],
      history.claims?.[fact],
      history.seen?.[fact],
    ).lastTested > 0
  );
}

/** The next sentence tier admitted by the original planner's linear
 * readability + grammar gate, evaluated entirely from precomputed fact ids. */
export function nextSentenceTierId(history: HistoryFile): string | null {
  for (const gate of INDEX.sentenceGates) {
    const readable = gate.readableItems.filter((item) =>
      item.lemmaFacts.every((alternatives) =>
        alternatives.some((fact) => factKnown(fact, history)),
      ),
    );
    if (readable.length < gate.minReadable) return null;
    if (
      gate.grammarPrereqFacts.length > 0 &&
      !gate.grammarPrereqFacts.some((fact) => factKnown(fact, history))
    ) {
      return null;
    }

    const facts = [...new Set(readable.flatMap((item) => item.facts))];
    if (sentenceTierDone(gate.tierId, facts, history)) continue;
    return gate.tierId;
  }
  return null;
}

/** The gated sentence lesson. Sentence completion is session-aware rather than
 * ordinary fact freshness, so select the admitted tier directly instead of
 * asking the generic scheduler to infer it from the marker alone. */
export function nextSentenceLearnLesson(
  units: readonly IndexUnit[],
  history: HistoryFile,
): UnitLessonOf<IndexUnit> | null {
  const tierId = nextSentenceTierId(history);
  if (!tierId) return null;
  const entry = INDEX.sentenceGates.find((gate) => gate.tierId === tierId)?.entry;
  const unit = entry ? units.find((candidate) => candidate.item.entry === entry) : undefined;
  return unit ? { units: [unit] } : null;
}

/** Rebuild the exact sentence tier carried by an open run. Unlike the generic
 * resume mask, this remains stable after assembly answers have entered history
 * and when the run's grammar facts are themselves part of the admission gate. */
export function sentenceLearnLessonForRun(
  units: readonly IndexUnit[],
  facts: readonly FactId[],
): UnitLessonOf<IndexUnit> | null {
  const held = new Set(facts);
  const entry = INDEX.sentenceGates.find((gate) =>
    held.has(sentenceTierMarkerFact(gate.tierId)),
  )?.entry;
  const unit = entry ? units.find((candidate) => candidate.item.entry === entry) : undefined;
  return unit ? { units: [unit] } : null;
}

/** Resolve a sentence lesson entry back to its tier without parsing opaque ids. */
export function sentenceTierIdOfEntry(entry: EntryId): string | null {
  return INDEX.sentenceGates.find((gate) => gate.entry === entry)?.tierId ?? null;
}

/** Fact → the id of the track that teaches it, built from the index itself. This
 * is how /learn routes an in-progress run to its track's card without reading the
 * fact registry: a counter fact lands under `numbers`, a vocab fact under `vocab`,
 * etc. — exactly the folding home-feed's old fact-subject resolver did. */
const TRACK_ID_OF_FACT: ReadonlyMap<FactId, string> = (() => {
  const m = new Map<FactId, string>();
  for (const track of INDEX.tracks) {
    for (const unit of track.units) {
      for (const fact of unit.facts) if (!m.has(fact)) m.set(fact, track.id);
    }
  }
  return m;
})();

/** The /learn track id that teaches a fact, or undefined for a fact the index
 * doesn't carry (a readable sentence-ordering drill fact, a fact from deleted
 * content). */
export function trackIdOfFact(fact: FactId): string | undefined {
  return TRACK_ID_OF_FACT.get(fact);
}

// CLIENT-SAFE /learn SCHEDULER — the same content-free frontier walk
// learn-index.ts runs, factored out so it can run WITHOUT a module-scope
// import of the ~1.4 MB learn-index.json (SAK-115).
//
// learn-index.ts binds these to its own module-scope `INDEX` (loaded from the
// JSON at import time) for server-side/test callers that want the old
// zero-index-argument API. A CLIENT component that needs to run this same
// walk reactively against a live, frequently-changing `history` — home-
// feed.tsx's per-track frontier, current-sessions.tsx's `trackKeyForRun` — has
// no room for one round trip per history change, so it instead fetches the
// index DATA once (getLearnIndexData in server-lookups.ts, cached forever by
// useServerLookup like getLibraryShelves — the data is build-fixed, only the
// history argument varies) and calls these same functions directly, taking
// that fetched snapshot as an explicit parameter instead of a closure.
//
// This file imports no JSON and no guarded module, so it is safe to import
// from a "use client" component.

import {
  isFactFresh,
  nextTrackLessonCore,
  type SchedulerDeps,
  type UnitLessonOf,
} from "./unit-scheduler-core";
import type { IndexSentenceGate, IndexTrack, IndexUnit, LearnIndex } from "./learn-index-types";
import type { LessonRange } from "@/lib/lesson-sizing";
import type { EntryId, FactId, HistoryFile } from "@/types";
import { effectiveState } from "@/lib/claims";
import {
  sentenceTierDone,
  sentenceTierMarkerFact,
} from "@/lib/sentence-ordering-progress";

/** The slice of `LearnIndex` `learnDepsOf` needs — a fetched snapshot or the
 * module-scope INDEX both satisfy it. */
export type LearnDepsIndex = Pick<LearnIndex, "resolve" | "blockerFacts">;

/** The precomputed deps: every touch-point the walk needs, served from `index`
 * instead of a closed-over module. Mirrors learn-index.ts's old LEARN_DEPS. */
export function learnDepsOf(index: LearnDepsIndex): SchedulerDeps<IndexUnit> {
  return {
    isFactFresh,
    resolvePrereq(entry: EntryId) {
      const node = index.resolve[entry as unknown as string];
      if (!node || !node.unit) return undefined;
      return { glyph: node.glyph, prereqs: node.prereqs, unit: node.unit };
    },
    isLearned(entry: EntryId, history: HistoryFile) {
      const facts = index.blockerFacts[entry as unknown as string] ?? [];
      return facts.length > 0 && facts.every((f) => !isFactFresh(f, history));
    },
  };
}

/** The next lesson for a /learn track's precomputed units, wired to history —
 * the content-free twin of `nextTrackLesson`. A pure function of history. */
export function nextLearnLesson(
  units: readonly IndexUnit[],
  history: HistoryFile,
  range: LessonRange,
  index: LearnDepsIndex,
  start: number = 0,
): UnitLessonOf<IndexUnit> | null {
  return nextTrackLessonCore(units, history, range, learnDepsOf(index), start);
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

/** The next sentence tier admitted by the original planner's linear pool-size +
 * grammar gate, evaluated entirely from precomputed fact ids. */
export function nextSentenceTierId(
  index: Pick<LearnIndex, "sentenceGates">,
  history: HistoryFile,
): string | null {
  for (const gate of index.sentenceGates) {
    if (gate.poolSize < gate.minReadable) return null;
    if (
      gate.grammarPrereqFacts.length > 0 &&
      !gate.grammarPrereqFacts.some((fact) => factKnown(fact, history))
    ) {
      return null;
    }

    if (sentenceTierDone(gate.tierId, gate.facts, history)) continue;
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
  index: Pick<LearnIndex, "sentenceGates">,
): UnitLessonOf<IndexUnit> | null {
  const tierId = nextSentenceTierId(index, history);
  if (!tierId) return null;
  const entry = index.sentenceGates.find(
    (gate) => gate.tierId === tierId,
  )?.entry;
  const unit = entry
    ? units.find((candidate) => candidate.item.entry === entry)
    : undefined;
  return unit ? { units: [unit] } : null;
}

/** Rebuild the exact sentence tier carried by an open run. Unlike the generic
 * resume mask, this remains stable after assembly answers have entered history
 * and when the run's grammar facts are themselves part of the admission gate. */
export function sentenceLearnLessonForRun(
  units: readonly IndexUnit[],
  facts: readonly FactId[],
  index: Pick<LearnIndex, "sentenceGates">,
): UnitLessonOf<IndexUnit> | null {
  const held = new Set(facts);
  const entry = index.sentenceGates.find((gate: IndexSentenceGate) =>
    held.has(sentenceTierMarkerFact(gate.tierId)),
  )?.entry;
  const unit = entry
    ? units.find((candidate) => candidate.item.entry === entry)
    : undefined;
  return unit ? { units: [unit] } : null;
}

/** Resolve a sentence lesson entry back to its tier without parsing opaque ids. */
export function sentenceTierIdOfEntry(
  entry: EntryId,
  index: Pick<LearnIndex, "sentenceGates">,
): string | null {
  return (
    index.sentenceGates.find((gate) => gate.entry === entry)?.tierId ?? null
  );
}

/** Fact → the id of the track that teaches it, built from the index's own
 * tracks. See learn-index.ts's original TRACK_ID_OF_FACT for the full "why". */
export function trackIdOfFactMap(
  tracks: readonly IndexTrack[],
): ReadonlyMap<FactId, string> {
  const m = new Map<FactId, string>();
  for (const track of tracks) {
    for (const unit of track.units) {
      for (const fact of unit.facts) if (!m.has(fact)) m.set(fact, track.id);
    }
  }
  return m;
}

/** The /learn track id that teaches a fact, or undefined for a fact the index
 * doesn't carry. */
export function trackIdOfFact(
  fact: FactId,
  map: ReadonlyMap<FactId, string>,
): string | undefined {
  return map.get(fact);
}

/** Has the app any record of this fact: answered, claimed, or "quiz me"'d? */
function factMet(fact: FactId, history: HistoryFile): boolean {
  return (
    effectiveState(
      history.facts[fact],
      history.claims?.[fact],
      history.seen?.[fact],
    ).lastTested !== 0
  );
}

/**
 * Every /learn track the learner has already touched, ignoring the facts of
 * the lesson about to be taught — the SAK-28 "track intro" card-0 gate. See
 * learn-index.ts's original `startedLearnTracks` for the full rationale;
 * unchanged here except `map` (trackIdOfFactMap's output) arrives as a
 * parameter instead of a closed-over module constant.
 */
export function startedLearnTracks(
  history: HistoryFile,
  exclude: ReadonlySet<FactId>,
  map: ReadonlyMap<FactId, string>,
): Set<string> {
  const started = new Set<string>();
  const seen = new Set<string>([
    ...Object.keys(history.facts ?? {}),
    ...Object.keys(history.claims ?? {}),
    ...Object.keys(history.seen ?? {}),
  ]);
  for (const key of seen) {
    const fact = key as FactId;
    if (exclude.has(fact)) continue;
    if (!factMet(fact, history)) continue;
    const track = trackIdOfFact(fact, map);
    if (track) started.add(track);
  }
  return started;
}

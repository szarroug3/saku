// UNIT SCHEDULER — the same lesson walk as `scheduler.ts` (planLesson), but over
// TEACHING UNITS (teach-unit.ts) instead of whole ContentItems. A unit is one
// SKILL: a pronunciation of a glyph, a keigo set, a grammar pattern, a verb pair.
// This schedules "teach 人 ひと (person)" before "teach 人 じん (-ian)" by how often
// each reading is spoken — the grain planLesson's per-item walk can't express —
// and, uniformly, any other track's units in that track's own order.
//
// POLYMORPHIC over the BASE unit. The walk reads only the base contract (`item`,
// `facts`, `cost`) via `isUnitDue`/`unitCost`, so a due unit can be ANY kind. The
// ORDER is the caller's — the pronunciation (vocab) track supplies
// CURRICULUM_SEQUENCE's own order (`curriculumOrderedUnits`, teach-unit.ts;
// SAK-162's per-pronunciation-frequency interleave already lives in that
// sequence), every other track supplies its curriculum sequence. The scheduler
// never orders; it fills, gates, and dedupes.
//
// THE WALK ITSELF LIVES IN unit-scheduler-core.ts, content-free. This module is
// the CONTENT-BACKED BINDING of it: it supplies the three touch-points the walk
// needs — dueness (`isFactFresh`), a prereq's primary unit (`resolveItem` +
// `primaryUnit`), and whether a blocker is learned (`factsOf`) — from the live
// dictionary. The /learn loader binds the SAME core to a precomputed index instead
// (learn-index.ts), so /learn runs this exact walk without the dictionary. Keeping
// one core means the two can never disagree; `contentResolvePrereq` here is also
// what the build script serializes, so the precomputed resolve IS this one's output.
//
// PREREQUISITES ACROSS THE UNIT GRAIN. A prerequisite lives on the ITEM
// (`ContentItem.prereqs`) — 何 is built on 人 and 可 regardless of which reading is
// being taught; a verb pair needs its kanji; a keigo set its plain verb. Every
// prereq edge points at a glyph the learner "meets" through its PRIMARY unit (its
// most-spoken reading), so a prereq is satisfied by that primary pronunciation
// unit. The chain a unit pulls is its item's untaught prereq glyphs, each as its
// primary unit, in dependency order. (A prereq the corpus can't yet resolve — a
// word, until the word track migrates `resolveItem` — is skipped, not a gate.)

import { factsOf } from "@/lib/facts";
import { buildGlyphItem } from "./build-item";
import { resolveItem } from "./resolve";
import {
  orderedUnits,
  pronunciationUnitsOf,
  byFrequencyDesc,
} from "./teach-unit";
import {
  MAX_PREREQ_DEPTH,
  isFactFresh,
  planUnitLessonCore,
  nextTrackLessonCore,
  type SchedulerDeps,
  type ResolvedPrereq,
} from "./unit-scheduler-core";
import type { PronunciationUnit, TeachingUnit, UnitLesson } from "./teach-unit";
import type { LessonRange } from "@/lib/lesson-sizing";
import type { EntryId, HistoryFile } from "@/types";

/** Whether an entry has been LEARNED — it has facts and all of them are claimed.
 * An entry with no facts (a word not in any curriculum) is never learned, so a
 * blocking edge onto it never lifts. */
function isLearned(entry: EntryId, history: HistoryFile): boolean {
  const facts = factsOf(entry);
  return facts.length > 0 && facts.every((f) => !isFactFresh(f, history));
}

/** A glyph's PRIMARY unit — its most-spoken reading, the one a learner "meets the
 * glyph" through. Undefined when the glyph builds no teachable item. This is the
 * unit a prerequisite edge onto the glyph is satisfied by. */
function primaryUnit(glyph: string): PronunciationUnit | undefined {
  const item = buildGlyphItem(glyph);
  if (!item) return undefined;
  return [...pronunciationUnitsOf(item)].sort(byFrequencyDesc)[0];
}

/**
 * Resolve a prereq entry to its primary unit — the content-backed binding the
 * walk's `deps.resolvePrereq` needs, and the exact thing the build script
 * serializes into the /learn index (so the precomputed resolve is byte-for-byte
 * this function's output). Mirrors the original inline `prereqChain` step:
 * `resolveItem(p)?.glyph` → `primaryUnit(pg)` → recurse on `buildGlyphItem(pg).prereqs`
 * (carried here as `item.prereqs`, which IS that).
 */
export function contentResolvePrereq(
  entry: EntryId,
): ResolvedPrereq<TeachingUnit> | undefined {
  const item = resolveItem(entry);
  if (!item) return undefined;
  const pu = primaryUnit(item.glyph);
  if (!pu) return undefined;
  return { glyph: item.glyph, prereqs: item.prereqs, unit: pu };
}

/** The content-backed deps: the live dictionary behind every touch-point the
 * lesson walk needs. */
const CONTENT_DEPS: SchedulerDeps<TeachingUnit> = {
  isFactFresh,
  resolvePrereq: contentResolvePrereq,
  isLearned,
};

/**
 * The pure core, factored out like `planLesson` so the depth gate is testable at
 * any `maxDepth`. Walk `order`; for each DUE unit gather its item's untaught prereq
 * primary units (dependency order), DEPTH-GATE anything whose untaught chain runs
 * past `maxDepth`, and fill toward the `range` floor — never past its ceiling except
 * a lone bundle that is oversized on its own. Dedupe by unit key so a shared
 * prerequisite (or a re-reached unit) is never taught twice; always emit at least
 * one unit if any is due. Uniform over the base unit — `order` is the track's.
 */
export function planUnitLesson(
  order: readonly TeachingUnit[],
  history: HistoryFile,
  range: LessonRange,
  maxDepth: number = MAX_PREREQ_DEPTH,
  start: number = 0,
): TeachingUnit[] {
  return planUnitLessonCore(order, history, range, CONTENT_DEPS, maxDepth, start);
}

/**
 * The next lesson's units for a track's own ORDERED units, wired to history. The
 * track owns the order (frequency, curriculum sequence, …); the scheduler supplies
 * dueness, cost, prerequisites, budget and the depth gate. A PURE function of
 * history. Returns the units in teach order (prereqs before the unit that needs
 * them), or null when nothing in `order` is due.
 */
export function nextTrackLesson(
  order: readonly TeachingUnit[],
  history: HistoryFile,
  range: LessonRange,
  start: number = 0,
): UnitLesson | null {
  return nextTrackLessonCore(order, history, range, CONTENT_DEPS, start);
}

/**
 * The next lesson's worth of teaching units for an arbitrary glyph set, RAW-
 * FREQUENCY ordered (`orderedUnits`) — a thin wrapper over `nextTrackLesson`
 * with that ordering. Not the live VOCAB track's own entry point any more
 * (that's `unit-tracks.ts`'s `vocabUnits`, over `curriculumOrderedUnits` —
 * see SAK-173); this remains a convenient, deterministic fixture for testing
 * the scheduler's own algorithm (dueness, prereqs, budget, depth gate) against
 * a small, easy-to-reason-about glyph set.
 */
export function nextUnitLesson(
  glyphs: readonly string[],
  history: HistoryFile,
  range: LessonRange,
): UnitLesson | null {
  return nextTrackLesson(orderedUnits(glyphs), history, range);
}

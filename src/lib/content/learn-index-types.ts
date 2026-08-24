// LEARN INDEX — the serialized shape of the precomputed /learn scheduling index
// (src/data/generated/learn-index.json), and NOTHING content. It carries only the
// scheduling/identity data the /learn frontier walk and the next-lesson preview
// read — glyph, typeLabel, fact-ids, prereqs, blockedBy — never a gloss, reading
// prose, or frequency table. The build script (scripts/build-learn-index.mjs)
// serializes the live derivation's output into this shape; the loader
// (learn-index.ts) rehydrates it and runs the content-free scheduler core over it.

import type { EntryId, FactId } from "@/types";
import type { SchedulableItem, SchedulableUnit } from "./unit-scheduler-core";

/** A content item, reduced to the fields the frontier walk and the preview read.
 * Extends the scheduler's `SchedulableItem` with the render-only `typeLabel`,
 * `kind`, and `roles` (item-preview shows glyph + typeLabel). */
export interface IndexItem extends SchedulableItem {
  readonly entry: EntryId;
  readonly glyph: string;
  readonly typeLabel: string;
  readonly kind: string;
  readonly roles: readonly string[];
  readonly prereqs: readonly EntryId[];
  readonly blockedBy: readonly EntryId[];
}

/** A teaching unit, reduced to the fields the walk needs plus what the preview
 * renders. Satisfies `SchedulableUnit`, so the content-free core schedules it
 * exactly as it schedules a live `TeachingUnit`. */
export interface IndexUnit extends SchedulableUnit {
  readonly kind: string;
  readonly scheduling?: "cost" | "unit";
  readonly reading?: string | null;
  readonly cost: number;
  readonly facts: readonly FactId[];
  readonly item: IndexItem;
}

/** A prereq entry resolved to its primary unit + the data to recurse — the
 * serialized form of `contentResolvePrereq`'s output. `unit` is null when the
 * corpus resolves the entry but it builds no primary unit (the content path skips
 * it identically). */
export interface IndexResolveNode {
  readonly glyph: string;
  readonly prereqs: readonly EntryId[];
  readonly unit: IndexUnit | null;
}

/** One track's ordered units, with its display id/title (duplicated here so the
 * loader needs no content module for them). */
export interface IndexTrack {
  readonly id: string;
  readonly title: string;
  readonly units: readonly IndexUnit[];
}

/** One sentence tier's complete unlock structure. `poolSize`/`facts` come from
 * `readableAssemblyForTier`, which is a purely structural filter (piece count,
 * unambiguous tier, the conditional-tier English guard) since SAK-87 dropped
 * its per-learner known-words check: the assembly screen shows a definition
 * for any unknown piece instead of hiding the sentence. So the pool is the
 * same for every history, and only `grammarPrereqFacts` stays history-
 * dependent. */
export interface IndexSentenceGate {
  readonly tierId: string;
  readonly entry: EntryId;
  readonly minReadable: number;
  /** ANY one must be known; empty means no grammar prerequisite. */
  readonly grammarPrereqFacts: readonly FactId[];
  /** How many assembly items this tier's structural filter admits. */
  readonly poolSize: number;
  /** Every fact those items can credit, deduped. */
  readonly facts: readonly FactId[];
}

/** The whole precomputed index. */
export interface LearnIndex {
  /** A hash over the serialized index — goes in the frontier cache key so a
   * content deploy invalidates cached frontiers (Phase 3 uses it; emitted now). */
  readonly curriculumVersion: string;
  readonly tracks: readonly IndexTrack[];
  /** Every resolvable prereq entry → its primary unit + recursion data. */
  readonly resolve: Readonly<Record<string, IndexResolveNode>>;
  /** Every BLOCKING-prerequisite entry → its facts, so `isLearned` runs without
   * the dictionary. */
  readonly blockerFacts: Readonly<Record<string, readonly FactId[]>>;
  /** Every curriculum glyph in prereq-respecting spine order (CURRICULUM_SEQUENCE
   * from curriculum-order.ts, serialized). Currently UNUSED by any card — home-
   * feed's vocabPositionLabel prints a TIGHT SEQUENTIAL span instead (`lessonSpan`,
   * track-completion.ts), never a positional span off this array.
   *
   * SAK-173: the vocab track's own order (unit-tracks.ts's `vocabUnits`, over
   * `curriculumOrderedUnits`) now IS this spine order — CURRICULUM_SEQUENCE
   * itself, not a raw-frequency reordering of it — so this array stopped being
   * actively WRONG for a per-lesson span the way it was when vocab scheduled by
   * raw SPOKEN FREQUENCY instead. It still isn't SAFE for one, for an unrelated
   * reason: an out-of-order Library claim elsewhere in the track can leave a
   * lesson's units scattered from where this array would place them — the same
   * "1–639 of 2,136" hazard lesson-position.ts's header (SAFE UNDER OUT-OF-ORDER
   * CLAIMS) warns every track's static order carries, span or not.
   *
   * DO NOT use this array to build a per-lesson "N of M" span by taking the
   * min/max index of a lesson's item glyphs, for that reason. See
   * lesson-position.ts's file header for the invariant a position has to
   * satisfy, and advancePosition() there for the one safe way to compute one. If
   * a track ever wants a "know N of M" figure without a positional span, count
   * claimed/seen items directly instead (see src/components/stats/by-subject.tsx),
   * which is order-independent and cannot suffer this failure mode. */
  readonly curriculumGlyphs: readonly string[];
  /** Sentence readability + grammar gates, serialized from the live planner. */
  readonly sentenceGates: readonly IndexSentenceGate[];
}

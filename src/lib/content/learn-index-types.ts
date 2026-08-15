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

/** One potentially-readable sentence, reduced to its history gate and the
 * grammar facts its completed assembly session can credit. */
export interface IndexSentenceGateItem {
  /** Every inner list is ANY-of; all lists must have a known fact. */
  readonly lemmaFacts: readonly (readonly FactId[])[];
  readonly facts: readonly FactId[];
}

/** One sentence tier's complete history-dependent unlock structure. */
export interface IndexSentenceGate {
  readonly tierId: string;
  readonly entry: EntryId;
  readonly minReadable: number;
  /** ANY one must be known; empty means no grammar prerequisite. */
  readonly grammarPrereqFacts: readonly FactId[];
  readonly readableItems: readonly IndexSentenceGateItem[];
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
  /** Every curriculum glyph in prereq-respecting spine order — the denominator
   * and positions the vocab card counts in (home-feed's vocabPositionLabel). */
  readonly curriculumGlyphs: readonly string[];
  /** Sentence readability + grammar gates, serialized from the live planner. */
  readonly sentenceGates: readonly IndexSentenceGate[];
}

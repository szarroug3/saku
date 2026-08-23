// THE FROZEN SPINE — the build-time twin of curriculum-order.ts's
// CURRICULUM_SEQUENCE / curriculumPosition.
//
// WHY THIS EXISTS
// ================
// curriculum-order.ts's buildSequence() is a cheap, pure walk of the shipped
// curriculum tables (SAK-161's investigation confirmed it: every kanji visited
// once, every lookup O(1)) — but it runs at MODULE LOAD, so every runtime
// importer re-runs the whole walk: once per Vercel serverless cold start on the
// server chain (server-lookups.ts -> lesson-steps.ts -> spine-intros.ts), and
// once per page load in the client bundle, because engine/question.ts (a
// curriculumPosition caller) is reachable from drill-screen.tsx and friends.
//
// scripts/build-curriculum-sequence.mjs runs the same walk once, at build time,
// and serializes its output to curriculum-sequence.json. This module reads that
// frozen array back — the same "compute once at build, read as data" shape
// word-rank.ts already uses over word-rank.json, and learn-index.ts uses over
// learn-index.json. Importing this pulls one small JSON array, not
// curriculum-order.ts's live computation (which in turn pulls data/kanji.ts,
// data/radicals.ts, lib/radical-order.ts, data/vocab.ts and lib/word-lesson.ts).
//
// BYTE-IDENTICAL, BY CONSTRUCTION. The build script never re-derives: it calls
// curriculum-order.ts's own CURRICULUM_SEQUENCE and serializes exactly what it
// returns. curriculum-sequence.equiv.test.ts is the safety net that asserts
// this array and `curriculumPosition` still agree with the live computation —
// that test, not this module, is what proves nothing drifted.
//
// A pure refactor (SAK-161): the sequence's CONTENTS and ORDER are unchanged.
// Changing the ordering algorithm itself is SAK-162, blocked on this one.

import curriculumSequenceJson from "@/data/generated/curriculum-sequence.json" with { type: "json" };
import type { CurriculumItem } from "@/lib/curriculum-order";

// Re-exported so a consumer can import the value and its type from this one
// module instead of also reaching into curriculum-order.ts. `export type` is
// erased at compile time, so this carries none of curriculum-order.ts's runtime
// weight — only the type declaration.
export type { CurriculumItem, CurriculumRole } from "@/lib/curriculum-order";

/** Every item the curriculum teaches, in order — the frozen twin of
 * curriculum-order.ts's `CURRICULUM_SEQUENCE`. See that module's header for what
 * the sequence means; this is the same array, precomputed. */
export const CURRICULUM_SEQUENCE: readonly CurriculumItem[] =
  curriculumSequenceJson as readonly CurriculumItem[];

/** Where a glyph sits in the spine, or -1 for anything the curriculum does not
 * teach. One item per glyph, so the position is unambiguous — the frozen twin
 * of curriculum-order.ts's `curriculumPosition`. */
const POSITION: ReadonlyMap<string, number> = new Map(
  CURRICULUM_SEQUENCE.map((it, i) => [it.glyph, i]),
);

export function curriculumPosition(glyph: string): number {
  return POSITION.get(glyph) ?? -1;
}

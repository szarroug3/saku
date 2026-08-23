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
// SAK-161 was a pure refactor: the sequence's CONTENTS and ORDER were unchanged,
// only WHERE it is computed. SAK-162 is the ordering change that refactor was
// blocking on: a word now owes one item per taught reading, not one item total
// — see curriculum-order.ts's header for what changed and why.

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

/** Where a glyph FIRST becomes taught in the spine, or -1 for anything the
 * curriculum does not teach — the frozen twin of curriculum-order.ts's
 * `curriculumPosition`. A word with more than one taught reading (七) occupies
 * more than one item (see CurriculumItem's `reading` field); first occurrence
 * wins, which is always that word's PRIMARY reading. See curriculum-order.ts's
 * header and `curriculumReadingPosition` below for one specific reading. */
const POSITION: ReadonlyMap<string, number> = (() => {
  const map = new Map<string, number>();
  for (let i = 0; i < CURRICULUM_SEQUENCE.length; i++) {
    const glyph = CURRICULUM_SEQUENCE[i].glyph;
    if (!map.has(glyph)) map.set(glyph, i);
  }
  return map;
})();

export function curriculumPosition(glyph: string): number {
  return POSITION.get(glyph) ?? -1;
}

/** Where ONE specific (word, reading) pair sits in the spine, or -1 — the
 * frozen twin of curriculum-order.ts's `curriculumReadingPosition`. */
const READING_POSITION: ReadonlyMap<string, number> = (() => {
  const map = new Map<string, number>();
  for (let i = 0; i < CURRICULUM_SEQUENCE.length; i++) {
    const item = CURRICULUM_SEQUENCE[i];
    if (item.reading === null) continue;
    map.set(`${item.glyph} ${item.reading}`, i);
  }
  return map;
})();

export function curriculumReadingPosition(glyph: string, reading: string): number {
  return READING_POSITION.get(`${glyph} ${reading}`) ?? -1;
}

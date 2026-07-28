// The teaching order, as a rank the Library shelf can sort on.
//
// WHY THIS EXISTS
// ===============
// The grammar shelf used to lay its patterns out in raw RECIPES order — the
// order they happen to be authored in data/grammar/recipes.ts, which groups them
// by function, not by when a learner meets them. A learner reading the shelf top
// to bottom should read it in the order the track TEACHES, so that "the next
// pattern down" is "the next pattern I will study". That order already exists:
// CURRICULUM_PATTERNS (src/lib/grammar-lesson.ts) is the drillable patterns in
// teaching order — te-sequence first, then N5 before N4 before N3, stable within
// a level.
//
// CURRICULUM_PATTERNS ONLY HAS THE 56 DRILLABLE PATTERNS, and the shelf shows all
// 96 (the recognition-only ones are real grammar a learner reads too). So this
// helper ranks EVERY recipe, on the same axes the curriculum sorts on:
//
//   1. te-sequence leads the whole track (it is grammar lesson 1, the
//      conjugation every other て-pattern is built on).
//   2. then by level tier: N5 before N4 before N3.
//   3. then by authored order within a level (the stable tail the curriculum
//      keeps — the functional grouping in recipes.ts).
//
// For the drillable subset these three keys reproduce CURRICULUM_PATTERNS exactly
// (the curriculum is DRILLABLE stably sorted by keys 1 and 2, and DRILLABLE is a
// subsequence of RECIPES, so key 3 is already its within-level order). The
// grammar-order.test.ts pins that equivalence, so this never drifts from the
// curriculum's own ordering. The recognition-only patterns slot into their
// authored position within their level, which is where they read best on the
// shelf.
//
// The shelf keeps its N5 / N4 / N3 section headers and sorts the entries WITHIN
// each section by this rank. Because the order is level-monotone, a section's
// within-level order is the teaching order, and reading the whole shelf top to
// bottom reads in lesson order.

import { RECIPES } from "@/data/grammar/recipes";
import type { Level, Recipe } from "@/data/grammar/recipes";

/** N5 before N4 before N3 — the depth tier, the one axis the teaching order
 * sorts on beyond te-sequence-first. Mirrors grammar-lesson.ts's levelRank. */
function levelRank(level: Level): number {
  return level === "N5" ? 0 : level === "N4" ? 1 : 2;
}

/** te-sequence — the bare て-form — leads the whole track (grammar lesson 1).
 * Mirrors grammar-lesson.ts's teFormFirst. */
function teFormFirst(r: Recipe): number {
  return r.id === "te-sequence" ? 0 : 1;
}

/** Every recipe, in teaching order: te-sequence first, then N5 → N4 → N3, stable
 * (authored) within a level. Computed once — it is a property of the data. */
export const GRAMMAR_TEACHING_ORDER: readonly Recipe[] = [...RECIPES].sort(
  (a, b) =>
    teFormFirst(a) - teFormFirst(b) || levelRank(a.level) - levelRank(b.level),
);

const RANK_BY_ID: ReadonlyMap<string, number> = new Map(
  GRAMMAR_TEACHING_ORDER.map((r, i) => [r.id, i]),
);

/** Where a pattern falls in the teaching order — its index in
 * GRAMMAR_TEACHING_ORDER. An unknown id sorts to the end, so a shelf built on a
 * stale id degrades to "last" rather than throwing. */
export function grammarRank(recipeId: string): number {
  return RANK_BY_ID.get(recipeId) ?? Number.MAX_SAFE_INTEGER;
}

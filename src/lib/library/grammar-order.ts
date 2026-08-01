// The teaching order, as a rank the Library shelf can sort on.
//
// WHY THIS EXISTS
// ===============
// The grammar shelf used to lay its patterns out in raw RECIPES order — the
// order they happen to be authored in data/grammar/recipes.ts, which groups them
// by function, not by when a learner meets them. A learner reading the shelf top
// to bottom should read it in the order the track TEACHES, so that "the next
// pattern down" is "the next pattern I will study".
//
// THE ORDER IS CURRICULUM_LESSONS ITSELF — the exact sequence the lessons walk
// (te-sequence first, then te-iru, then the rest, N5 before N4 before N3). We
// take the lesson order directly rather than re-deriving a sort, so the shelf can
// never disagree with the lessons: the two used to differ on 〜ている (the lesson
// track pins it second, right behind the bare て-form it builds on, while a
// level-only sort left it in its authored spot), and reading the shelf in a
// different order than you are taught is the confusion this removes. Every recipe
// is in CURRICULUM_LESSONS now (all recipes are taught), so the map covers the whole
// shelf, recognition-only patterns included.
//
// The shelf keeps its N5 / N4 / N3 section headers and sorts the entries WITHIN
// each section by this rank. Because the lesson order is level-monotone, a
// section's within-level order is the teaching order, and reading the whole shelf
// top to bottom reads in lesson order.

import { CURRICULUM_LESSONS } from "@/data/grammar/lessons";
import { RECIPES } from "@/data/grammar/recipes";
import type { Recipe } from "@/data/grammar/recipes";

const RECIPE_BY_ID: ReadonlyMap<string, Recipe> = new Map(RECIPES.map((r) => [r.id, r]));

/** Every recipe, in the lessons' own teaching order. Derived from
 * CURRICULUM_LESSONS so it IS the lesson order, not a re-derivation of it. */
export const GRAMMAR_TEACHING_ORDER: readonly Recipe[] = CURRICULUM_LESSONS.flatMap(
  (lesson) =>
    (lesson.recipeIds ?? [lesson.primaryPattern])
      .map((id) => RECIPE_BY_ID.get(id))
      .filter((r): r is Recipe => Boolean(r)),
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

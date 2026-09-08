// Every URL the Sky links to, built here and nowhere else (SAK-367).
//
// Nine places used to do the same string surgery, each with its own
// `sample ? "sample&" : ""` and `includes("?") ? "&" : "?"`, and the two in
// the Atlas encoded a list of ids one way while the other five encoded it
// another. One builder means the query names live in one file, the keys come
// out in one order, and a component under src/sky never learns that "picks"
// is what its list of ids is called.
//
// `idsFrom` is the mirror: what a page.tsx reads a `picks=` or `cards=` back
// with. Both forms of the old encoding split the same, so a link written
// before this still opens.

import type { Recipe } from "@/sky/lib/practice";
import type { RunSource } from "@/sky/lib/quiz-run";

/** What can ride in a Sky URL's query. */
export interface SkyQuery {
  /** The pretend learner, recording nothing. A flag with no value. */
  sample?: boolean;
  /** Who linked here, so the way back can say where it goes (SAK-353). */
  from?: string;
  /** A practice recipe, carried whole. */
  recipe?: Recipe;
  /** The items a lesson or a quiz was asked for. */
  picks?: readonly string[];
  /** The exact cards to ask, a retry. */
  cards?: readonly string[];
}

/** A recipe in a URL. Its mirror is the `JSON.parse` in practice/run. */
const packRecipe = (recipe: Recipe) => encodeURIComponent(JSON.stringify(recipe));

/** A list of ids in a URL. Its mirror is `idsFrom`. */
const packIds = (ids: readonly string[]) => encodeURIComponent(ids.join(","));

/** A path with a query, or the bare path when nothing is asked for.
 *
 * The keys come out in the order they are declared here, so the same call
 * always writes the same string. An empty list is no key at all, which is
 * what "quiz me on what is due" looks like. */
export function skyHref(path: string, query: SkyQuery = {}): string {
  const parts: string[] = [];
  if (query.sample) parts.push("sample");
  if (query.from) parts.push(`from=${encodeURIComponent(query.from)}`);
  if (query.recipe) parts.push(`recipe=${packRecipe(query.recipe)}`);
  if (query.picks?.length) parts.push(`picks=${packIds(query.picks)}`);
  if (query.cards?.length) parts.push(`cards=${packIds(query.cards)}`);
  return parts.length ? `${path}?${parts.join("&")}` : path;
}

/** Where a saved run is answered (SAK-404): the quiz, or practice's run page
 * when the deck came from a recipe.
 *
 * A run keeps its recipe as `recipeKey` wrote it, which is the canonical
 * recipe as JSON, so parsing it back gives a recipe that draws the same deck.
 * A key this cannot parse is a run from a shape we no longer write, and the
 * quiz is the honest place to send it: it will find no run of its own there
 * and deal what is due. */
export function runHref(from: RunSource, sample = false): string {
  if (from.recipe) {
    try {
      return skyHref("/practice/run", { sample, recipe: JSON.parse(from.recipe) as Recipe });
    } catch {
      return skyHref("/quiz", { sample });
    }
  }
  return skyHref("/quiz", { sample, picks: from.picks, cards: from.cards });
}

/** The ids in a `picks=` or `cards=`, however Next handed the value over.
 *
 * A repeated key arrives as an array, which reads as one comma-joined list,
 * the same as `?picks=a,b`. Blanks are dropped, so a trailing comma is not an
 * empty pick. */
export function idsFrom(value: string | string[] | undefined): string[] {
  const raw = Array.isArray(value) ? value.join(",") : (value ?? "");
  return raw.split(",").map((s) => s.trim()).filter(Boolean);
}

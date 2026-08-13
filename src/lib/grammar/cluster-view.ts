// What the cluster page SHOWS, decided here rather than in the component.
//
// Two questions, both of which have a wrong answer that is easy to reach for,
// so both are settled once, in a pure function, with tests on them.
//
// THE GLYPH SLOT IS GENERATED FROM `pattern`, NEVER FROM A GLOSS.
// ==============================================================
// Every entry page in the Library leads with a big glyph, and a cluster wants
// the same shape. The tempting source is the gloss — "てから and たあとで" reads
// like it holds the two patterns and it nearly does. It is DISPLAY TEXT, and
// recovering a structural fact by parsing display text is the exact mistake
// build.ts's header records making and undoing with its old `complete` flag. So
// the slot is built from the members' own `pattern` strings, which are data.
//
// That leaves the question of WHEN there is a glyph at all, and the honest
// answer is: only when the family has one shared shape to show.
//
//   2 members  → both patterns, stacked. They are short and they are the whole
//                family, so the slot IS the cluster. Six clusters land here.
//   0 members, Japanese title → the title. The map-only clusters name their own
//                pair (は vs が) and it is already the thing to look at.
//   otherwise  → NOTHING. obligation (7), seems (6) and conditionals (4) have no
//                shared form, and there is no honest single glyph for seven
//                different endings. Stacking seven patterns would be the table
//                printed twice; picking one would say it speaks for the rest;
//                inventing 〜な… would be inventing. The title alone is right.

import type { Cluster } from "../../data/grammar/clusters.ts";
import type { Recipe } from "../../data/grammar/recipes.ts";

/** Any kana or CJK character. Used only to ask whether a TITLE is Japanese —
 * "は vs が" is, "must" is not. A title is authored text and this is a test of
 * it, not a parse of it: nothing is extracted, the whole string is used as-is. */
const JAPANESE = /[぀-ヿ一-鿿]/u;

/**
 * The lines of the big glyph slot, top to bottom. Empty means NO GLYPH — the
 * caller drops the slot rather than filling it with something approximate.
 *
 * See the header for why each branch is what it is.
 */
export function glyphLines(c: Cluster, members: readonly Recipe[]): string[] {
  if (members.length === 2) return members.map((r) => r.pattern);
  if (members.length === 0 && JAPANESE.test(c.title)) return [c.title];
  return [];
}

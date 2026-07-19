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
//
// THE TABLE IS GROUPED BY HOST BECAUSE THE ROWS ALREADY WERE.
// ==========================================================
// `buildRows` emits one row per (recipe, host) — that is why `seems` has six
// members and thirteen rows. Ungrouped, the reader meets 降りそう, then 高そう,
// then 静かそう, then 本のそう… and has to work out for themselves that the
// column changed what it was attached to halfway down. The group heading says
// it: "On an い-adjective · 高い".
//
// NINE OF THE TWELVE CLUSTERS ARE A SINGLE GROUP and that is the point rather
// than a degenerate case. One heading over the obligation seven is the line that
// says all seven hang off the same verb, which is the whole reason those seven
// rows differ only in their ending.

import type { BuiltRow } from "./build.ts";
import { HOST_ARTICLE } from "./formula.ts";
import type { Cluster } from "../../data/grammar/clusters.ts";
import type { Host, Recipe } from "../../data/grammar/recipes.ts";

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

/** One host's worth of rows, with the heading that names it. */
export interface HostGroup {
  readonly host: Host;
  /** "On a verb", "On an い-adjective" — the article comes from formula.ts, so
   * this page and the entry page call a な-adjective the same thing. */
  readonly label: string;
  /** The word the group is demonstrated on. 行く. From the rows, never typed. */
  readonly word: string;
  readonly rows: readonly BuiltRow[];
}

/**
 * Rows grouped by host, in the order the hosts first appear.
 *
 * Order is first-seen rather than a fixed verb/adj/noun list on purpose: the
 * rows arrive in the recipes' own attach order, which is verb-first throughout,
 * and a second ordering here would be a second place for the table's reading
 * order to be decided. EVERY ROW LANDS IN EXACTLY ONE GROUP — the concatenated
 * groups are a permutation of the input, which is what the test asserts, because
 * a grouping that silently drops a row would be a hole in the one table on this
 * page that claims it cannot be wrong.
 *
 * The word is the group's FIRST row's opening slot. A wrap row is built on two
 * words (本 and 車); the heading names the one the group is about, and the row
 * itself shows both.
 */
export function hostGroups(rows: readonly BuiltRow[]): HostGroup[] {
  const out: HostGroup[] = [];
  const byHost = new Map<Host, BuiltRow[]>();
  for (const row of rows) {
    let bucket = byHost.get(row.host);
    if (!bucket) {
      bucket = [];
      byHost.set(row.host, bucket);
      out.push({
        host: row.host,
        label: `On ${HOST_ARTICLE[row.host]}`,
        word: row.on[0] ?? "",
        rows: bucket,
      });
    }
    bucket.push(row);
  }
  return out;
}

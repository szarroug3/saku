// Splitting a list of stars into the part that is the same for everyone and
// the part that is not (SAK-381).
//
// Two surfaces send a big list of items that barely differs between learners:
// the home's sky (15,380 items, 2.2 MB) and the Atlas's shelves (2,815 items,
// 350 KB). In both, an item is the same for everybody except for its
// standing. So both send their items once, as a catalogue, and per learner
// send only the standings.
//
// This is the half the two share. What they do not share is what else rides
// along: the home has its constellations and its firmament, the Atlas its
// shelves and their counts, and each keeps that in its own file.
//
// Pure, and used on both sides of the wire: the server splits, the browser
// joins.

import type { Standing } from "@/sky/lib/standing";
import type { SkyItem } from "@/sky/lib/types";

/** A star with everything but how it is going. */
export type SkyItemBase = Omit<SkyItem, "standing">;

/** What every learner sees the same way. */
export function withoutStanding(item: SkyItem): SkyItemBase {
  const { standing: _standing, ...rest } = item;
  return rest;
}

/** One learner's items as the difference from a catalogue's. */
export interface ItemDiff {
  /** Only the stars that have got somewhere. Anything absent is not-seen. */
  standings: Readonly<Record<string, Standing>>;
  /** Stars the catalogue does not have, or has differently. Usually none. */
  extras: readonly SkyItem[];
}

/**
 * The difference between a learner's items and the catalogue's.
 *
 * `extras` is the escape hatch and the reason this is safe. A catalogue is
 * built by running the real pipeline against an empty history, and that is
 * very nearly enough: the Observatory offers things by what has been met, and
 * offering an entry can change its kind, so a learner's list can hold an item
 * the empty one does not, or hold one differently. Anything that does not
 * match the catalogue exactly travels whole. Normally there are none;
 * correctness never depends on there being none.
 */
export function splitItems(items: readonly SkyItem[], catalogue: readonly SkyItemBase[]): ItemDiff {
  const base = baseOf(catalogue);
  const standings: Record<string, Standing> = {};
  const extras: SkyItem[] = [];
  for (const item of items) {
    const known = base.get(item.id);
    if (known !== undefined && known === JSON.stringify(withoutStanding(item))) {
      if (item.standing !== "not-seen") standings[item.id] = item.standing;
      continue;
    }
    extras.push(item);
  }
  return { standings, extras };
}

/** The catalogue, written out once, ready to compare against. Held against
 * the catalogue itself: a request should not spend its time serialising
 * fifteen thousand items that were the same on the last one. */
const written = new WeakMap<readonly SkyItemBase[], Map<string, string>>();

function baseOf(catalogue: readonly SkyItemBase[]): Map<string, string> {
  const have = written.get(catalogue);
  if (have) return have;
  const made = new Map(catalogue.map((i) => [i.id, JSON.stringify(i)]));
  written.set(catalogue, made);
  return made;
}

/** The catalogue's items with this learner's standings on them, plus whatever
 * the catalogue did not have. */
export function joinItems(catalogue: readonly SkyItemBase[], diff: ItemDiff): SkyItem[] {
  const extras = new Map(diff.extras.map((i) => [i.id, i]));
  const out: SkyItem[] = [];
  for (const base of catalogue) {
    const instead = extras.get(base.id);
    if (instead) {
      out.push(instead);
      extras.delete(base.id);
      continue;
    }
    out.push({ ...base, standing: diff.standings[base.id] ?? "not-seen" });
  }
  // whatever is left is a star this learner has and the catalogue does not
  out.push(...extras.values());
  return out;
}

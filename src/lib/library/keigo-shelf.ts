// The "Keigo" shelf, cut into the groups the track teaches.
//
// A shelf is cut where the cut MEANS something to the reader (see shelves.tsx).
// The keigo sets split into the verb sets — a plain verb and its honorific and
// humble forms — and the formulaic phrase that has no plain verb of its own. So
// the sections are those two groups, in teaching order.
//
// It lives in a .ts, not beside the JSX in shelves.tsx, so the test runner (no
// JSX) can hold the property that matters here: the shelf lists every keigo set
// entry, exactly once, resolved to a real Library page.

import { KEIGO_SETS, keigoSetEntry, type KeigoSet } from "@/data/keigo";
import { libEntry } from "@/lib/library/library-index";
import type { ShelfSection } from "@/lib/library/shelf-view";

/** One section of the shelf: a name and the predicate that fills it. In teaching
 * order, and mutually exclusive over the curriculum — every set falls in exactly
 * one group. */
interface KeigoGroup {
  readonly id: string;
  readonly label: string;
  readonly keep: (set: KeigoSet) => boolean;
}

const GROUPS: readonly KeigoGroup[] = [
  // Set phrases first: いらっしゃいませ has no gate so it unlocks first in the curriculum.
  { id: "phrases", label: "Set phrases", keep: (s) => !!s.formulaic },
  // Verb sets follow in teaching order (KEIGO_SETS is sorted by gate verb beginnerRank).
  { id: "verbs", label: "Honorific and humble verbs", keep: (s) => !s.formulaic },
];

/**
 * The keigo shelf's sections, each holding its group's entries in curriculum
 * order.
 *
 * An empty group drops out — a card with nothing under it is a worse answer than
 * no card. Each set is resolved to its LibEntry by a lookup, never a parse, and
 * skipped if the build has no entry for it, the same degradation every other
 * shelf takes.
 */
export function keigoShelfSections(): ShelfSection[] {
  return GROUPS.map((g) => ({
    id: `keigo-${g.id}`,
    label: g.label,
    entries: KEIGO_SETS.filter(g.keep).flatMap((s) => {
      const e = libEntry(keigoSetEntry(s));
      return e ? [e] : [];
    }),
  })).filter((s) => s.entries.length > 0);
}

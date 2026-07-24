// The All tab's BROWSE side — which subjects it stacks, in what order.
//
// The All tab shows every subject at once (search buckets by type; see
// search.ts's searchByType). Browsing it, with no query, is the same idea for
// the shelves: one block per subject, in the curriculum TEACHING ORDER the tabs
// already use (KINDS: kana → radicals → kanji → words → …), each block the very
// same section/table render its own tab draws.
//
// TWO THINGS THIS PURE HELPER DECIDES, both testable without JSX:
//
//   ENUMERATION. With no knowledge filter, every subject in KINDS is present and
//   in order — the All tab spans the whole curriculum, not a hand-picked few.
//
//   EMPTY SUBJECTS DROP OUT. Under a Known / Not-known filter a whole subject can
//   have nothing left (nothing on the Terms shelf is "known" yet). That subject
//   is absent — no empty heading — the same way `filterSections` drops a section
//   the filter empties. The emptiness is read off `shownSectionsOf`, the shared
//   view math the per-tab shelf render uses, so All and the single tab agree on
//   what "has anything to show" means.
//
// It takes `sectionsForKind` rather than importing shelfSections because that
// lives in a .tsx (JSX the test runner cannot strip); handed the cut, this file
// is pure array work and the properties above are unit-tested in all-tab.test.ts.

import { KINDS, type Kind, type LibEntry } from "@/lib/library/entries";
import { shownSectionsOf, type ShelfSection } from "@/lib/library/shelf-view";

/** How many SECTIONS the All-tab browse paints per subject before it defers the
 * rest to that subject's own tab.
 *
 * All spans a lot — the words shelf alone is 12,553 entries across 252 ranged
 * groups, and its own tab paints them ALL on purpose (see ranged-groups.ts). The
 * All tab cannot: ten subjects stacked, each painting everything, is the laggy
 * all-kinds render the Library removed once already. So every subject shows only
 * its first couple of groups as a taste, with a counted "open the tab" link for
 * the rest — #27's ranged-groups honesty (a screenful, then search) applied one
 * level up, per subject. Two, not one, so a subject with a tiny leading group
 * (kana's 5 vowels) still shows something worth reading before the fold. */
export const ALL_TAB_SECTIONS_PER_KIND = 2;

/**
 * The subjects the All-tab browse renders, in teaching order — every KIND whose
 * shelf still has something to show under `keep`, with the empty ones dropped.
 *
 * `keep` is the knowledge filter (undefined = All, keep everything);
 * `sectionsForKind` hands over each subject's cut (the page passes its memoised
 * shelvesByKind). Emptiness is decided by `shownSectionsOf`, the same math the
 * per-tab render uses, so a subject is here iff its own tab would show a shelf.
 */
export function allTabBrowseKinds(
  keep: ((entry: LibEntry) => boolean) | undefined,
  sectionsForKind: (kind: Kind) => readonly ShelfSection[],
): Kind[] {
  return KINDS.filter(
    (kind) => shownSectionsOf(kind, sectionsForKind(kind), keep).length > 0,
  );
}

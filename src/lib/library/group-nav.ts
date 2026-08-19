// Prev/next navigation WITHIN one entry's group — the same section a shelf
// would show it under (e.g. "Hiragana · Vowels あ"), not the whole shelf and
// not the whole Library. See SAK-64.
//
// GROUP MEMBERSHIP IS WHATEVER shelfSections ALREADY SAYS IT IS. The Library
// grid is the one place group boundaries are authored — kana rows in
// characters.ts, kanji hundreds in kanji-shelf.ts, word/radical/primitive
// ranges in ranged-groups.ts, and so on — and every one of them already comes
// out as a ShelfSection with an ordered `entries` array. Re-deriving group
// membership here (e.g. by re-reading CHAR_INDEX.sec) would be a second
// description of the same boundary, free to drift from the one the shelf
// actually renders. So this module does no grouping of its own: it asks
// `shelfSections` for the entry's kind, finds the one section that contains
// the entry, and walks one step either side of it.
//
// EDGES DO NOT WRAP. The first entry in a group has no previous neighbour and
// the last has no next one — `prev`/`next` come back null and the caller
// disables or hides the control, matching every other edge case in the
// Library. Nothing else in this app wraps a browsing list around (Shift-range
// selection stops at the ends; ranged-groups does not loop), so there is no
// existing convention to match by wrapping instead.

import { shelfSections } from "@/lib/library/shelf-sections";
import type { LibEntry, Kind } from "@/lib/library/entries";
import type { ShelfSection } from "@/lib/library/shelf-view";

/** One kind's sections, computed once and kept for the app's lifetime — the
 * same lazy-and-cached shape library-page.tsx's SHELF_CACHE uses, and for the
 * same reason: `shelfSections(k, "everyday")` depends only on the shipped
 * tables, so it is the same cut for every learner and every mount. Kept as its
 * own cache rather than sharing library-page.tsx's module-private one so this
 * module has no import edge onto a page component — it depends only on
 * @/lib/library/shelf-sections, the plain data module shelfSections now lives
 * in (see that file's header for why it moved out of shelves.tsx). */
const SECTIONS_CACHE = new Map<Kind, readonly ShelfSection[]>();

function sectionsFor(kind: Kind): readonly ShelfSection[] {
  let sections = SECTIONS_CACHE.get(kind);
  if (!sections) {
    // "everyday" is not a user setting: library-page.tsx hard-codes the same
    // literal for the identical reason (see its SHELF_CACHE comment) — the
    // kanji shelf's ordering is the only kind that branches on it, and this
    // app has no kanji-order preference to read. Matching the literal here
    // keeps a kanji's neighbours the same ones the shelf itself shows.
    sections = shelfSections(kind, "everyday");
    SECTIONS_CACHE.set(kind, sections);
  }
  return sections;
}

/** The section membership and ordered neighbours would need. */
export interface GroupNeighbors {
  /** The section's label, exactly as the shelf prints it — "Hiragana · Vowels
   * あ" — or null when the entry's kind renders no section that contains it
   * (should not happen for anything `libEntry` can resolve, but a screen must
   * not crash on a stranger). */
  readonly groupLabel: string | null;
  /** True when `groupLabel` is a bare numeric span ("1–50") standing in for a
   * real category, carried straight from the section's own `isRangeLabel` (see
   * ShelfSection). The caller should treat this the same as no label at all:
   * a range span names which GROUP_SIZE-wide bucket the entry falls in, not
   * anything about the entry, so it is not worth a header on the entry's own
   * page — even though the identical label earns its place on the shelf page,
   * where it drives a tri-state select-all over that range. */
  readonly isRangeLabel: boolean;
  /** The entry immediately before this one in its group, or null at the first
   * entry (edges do not wrap — see the file header). */
  readonly prev: LibEntry | null;
  /** The entry immediately after this one in its group, or null at the last
   * entry. */
  readonly next: LibEntry | null;
}

const EMPTY: GroupNeighbors = { groupLabel: null, isRangeLabel: false, prev: null, next: null };

/** Where one entry sits in its shelf section, and its immediate neighbours. */
export function groupNeighbors(entry: LibEntry): GroupNeighbors {
  const sections = sectionsFor(entry.kind);
  const section = sections.find((s) => s.entries.some((e) => e.id === entry.id));
  if (!section) return EMPTY;
  const index = section.entries.findIndex((e) => e.id === entry.id);
  return {
    groupLabel: section.label,
    isRangeLabel: section.isRangeLabel ?? false,
    prev: index > 0 ? section.entries[index - 1] : null,
    next: index < section.entries.length - 1 ? section.entries[index + 1] : null,
  };
}

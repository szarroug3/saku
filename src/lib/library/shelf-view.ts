// The shelf's VIEW MATH — the knowledge filter and the section cap, as pure
// array work, so the two places that must agree on "what the shelf shows"
// (`Shelf`'s render and `visibleShelfIds`, its Shift-range mirror) share one
// implementation instead of two hand-synced copies. It lives in a .ts, not
// beside the JSX, so the test runner (Node's type stripper, no JSX) can hold
// the property these functions exist to keep true.
//
// THE ORDER IS FILTER, THEN CAP, AND THAT ORDERING IS THE FIX. The kanji shelf
// paints only the first KANJI_SECTIONS_SHOWN of its range sections, but that cap
// must be taken AFTER the knowledge filter, never before. Capping first (which
// the shelf used to do, in shelfSections) meant "Not known" ran against just the
// first three sections: if the first ~300 kanji were all known, those three
// emptied and the shelf said "everything is already known" while thousands of
// unknown kanji sat in sections four and on. Building every section, filtering
// each, dropping the empty ones, and THEN taking the first three that survive is
// what lets the filter see the whole shelf.

import { KANJI_SUBJECT } from "@/data/kanji";
import { VOCAB_SUBJECT } from "@/data/vocab";
import type { LibEntry, Kind } from "@/lib/library/entries";
import { KANJI_SECTIONS_SHOWN } from "@/lib/library/kanji-shelf";
import type { EntryId } from "@/types";

/** One cut of a shelf: a name and the entries under it. */
export interface ShelfSection {
  readonly id: string;
  readonly label: string;
  readonly entries: readonly LibEntry[];
  /** Tiles to paint before deferring the rest to search, if the section is too
   * big to render whole. Only the huge school-grade sections set it; a section
   * without one is shown in full, which is every section on every other shelf
   * and every range section on the kanji shelf. */
  readonly cap?: number;
}

/** How many word tiles the words shelf shows before it tells you to search.
 *
 * A display cap: the words shelf shows this many everyday-word tiles and points
 * the rest at search. The drill is now built from what you SELECT, so there is
 * no longer a hidden "all 8,045" the bar acts on behind a screenful of 120 —
 * what you can see and toggle is what you drill. */
export const WORD_TILES = 120;

/** How many SECTIONS a shelf paints, applied AFTER the knowledge filter.
 *
 * Only the kanji RANGE modes cap here: 2,136 kanji is 22 range cards and three
 * is plenty on one page, so the rest is search's job (see kanji-shelf.ts). Every
 * other shelf — and kanji `grade` mode, whose seven sections ARE the study order
 * and carry their own per-section tile cap — shows all of its sections, so this
 * is Infinity and the later slice is a no-op.
 *
 * Grade mode is told apart from the range modes by its per-section tile `cap`
 * (KANJI_TILES): only the grade sections set it, the range sections leave it
 * undefined. Reading the sections rather than re-threading the kanji ORDER down
 * here keeps this function pure over what it is handed. */
export function sectionCapFor(kind: Kind, sections: readonly ShelfSection[]): number {
  if (kind !== KANJI_SUBJECT) return Infinity;
  const isGrade = sections.some((s) => s.cap !== undefined);
  return isGrade ? Infinity : KANJI_SECTIONS_SHOWN;
}

/** Each section keeping only the entries that pass the filter, with the sections
 * the filter empties dropped — a card headed "1–100" with nothing under it would
 * be a worse answer than no card. With no filter the sections pass through
 * unchanged (a copy, so callers can slice without touching the input). */
export function filterSections(
  sections: readonly ShelfSection[],
  keep?: (entry: LibEntry) => boolean,
): ShelfSection[] {
  if (!keep) return sections.slice();
  return sections
    .map((s) => ({ ...s, entries: s.entries.filter(keep) }))
    .filter((s) => s.entries.length > 0);
}

/** The sections the shelf actually PAINTS: filtered, emptied ones dropped, then
 * capped to the shelf's section limit. The single source both the render and the
 * range mirror read, so they cannot drift. */
export function shownSectionsOf(
  kind: Kind,
  sections: readonly ShelfSection[],
  keep?: (entry: LibEntry) => boolean,
): ShelfSection[] {
  return filterSections(sections, keep).slice(0, sectionCapFor(kind, sections));
}

/**
 * The ids the shelf actually PAINTS, in display order — what a Shift-click range
 * is allowed to reach. It mirrors `Shelf`'s render exactly and must stay in lock
 * step with it: the words shelf's `WORD_TILES` slice, each section's knowledge
 * filter, the dropping of sections the filter empties, the section cap taken
 * AFTER the filter, and each section's render `cap`. Anything the shelf hides
 * (past the word cap, filtered out, beyond the section cap, or beyond a grade
 * section's tile cap) is absent here, so the range can never select it.
 *
 * It shares `shownSectionsOf` with the render, not a hand-synced copy, so the
 * two cannot drift: the same `keep` and caps govern both.
 */
export function visibleShelfIds(
  kind: Kind,
  sections: readonly ShelfSection[],
  allEntries: readonly LibEntry[],
  keep?: (entry: LibEntry) => boolean,
): EntryId[] {
  if (kind === VOCAB_SUBJECT) {
    const words = keep ? allEntries.filter(keep) : allEntries;
    return words.slice(0, WORD_TILES).map((e) => e.id);
  }
  return shownSectionsOf(kind, sections, keep).flatMap((s) =>
    s.entries.slice(0, s.cap ?? Infinity).map((e) => e.id),
  );
}

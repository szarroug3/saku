// Pure Library shelf view math shared by the renderer and Shift-range
// selection. Every matching section and entry remains visible; render cost is
// controlled by near-viewport mounting in shelves.tsx rather than data caps.

import type { LibEntry, Kind } from "@/lib/library/entries";
import type { EntryId } from "@/types";

export interface ShelfSection {
  readonly id: string;
  readonly label: string;
  readonly entries: readonly LibEntry[];
  /** Force this section to render as ROWS even on an otherwise tile shelf. The
   * counters shelf uses it for its leading "Constructions" section: those entries
   * carry a 十〜 / 〜本 plate for a glyph, so they are not glyphless (which would
   * pick rows on its own), but a named reference page reads across a line, not
   * inside a 100px tile. Undefined everywhere else. */
  readonly asRows?: boolean;
}

/** Apply a knowledge/status filter and remove sections it empties. */
export function filterSections(
  sections: readonly ShelfSection[],
  keep?: (entry: LibEntry) => boolean,
): ShelfSection[] {
  if (!keep) return sections.slice();
  return sections
    .map((section) => ({
      ...section,
      entries: section.entries.filter(keep),
    }))
    .filter((section) => section.entries.length > 0);
}

/** Every filtered section is shown; no subject-level cap remains. */
export function shownSectionsOf(
  _kind: Kind,
  sections: readonly ShelfSection[],
  keep?: (entry: LibEntry) => boolean,
): ShelfSection[] {
  return filterSections(sections, keep);
}

/** Visible entry ids in the exact order used by Shift-range selection. */
export function visibleShelfIds(
  kind: Kind,
  sections: readonly ShelfSection[],
  keep?: (entry: LibEntry) => boolean,
): EntryId[] {
  return shownSectionsOf(kind, sections, keep).flatMap((section) =>
    section.entries.map((entry) => entry.id),
  );
}

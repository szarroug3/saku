// THE LIBRARY'S SELECTION — a global set of toggled entries that you BUILD a
// drill out of, not a single row the bar happens to point at.
//
// WHY THIS IS ITS OWN LAYER, AND ITS OWN TYPE
// ===========================================
// Home has a `Selection` (src/lib/selection.ts) and it is a different thing: one
// picked shelf plus a limit, the input to a quiz. This is a SET — several kana
// rows, a handful of individual glyphs, a kanji you searched for — unioned into
// one drill. The two never share a shape, so the Library keeps its own here and
// the shared model stays untouched.
//
// THE SET IS CROSS-KIND AND GLOBAL. An EntryId already names its subject (a kana
// id and a kanji id can never collide — see minters in each data module), so a
// single flat set of ids spans kana, kanji and words with no per-kind bucket.
// Switching the kind filter changes what you SEE, never what is IN here — the
// whole "select in hiragana, keep it while you browse kanji" requirement is just
// "this set is not indexed by kind".

import type { Slice } from "@/lib/library/slice";
import type { EntryId } from "@/types";
import type { LibEntry } from "@/lib/library/entries";

/** The selection: which entries are toggled on. Flat, cross-kind, order-free. */
export type Selection = ReadonlySet<EntryId>;

export const EMPTY_SELECTION: Selection = new Set<EntryId>();

/** Toggle one entry — the individual-tile action. */
export function toggleEntry(sel: Selection, id: EntryId): Set<EntryId> {
  const next = new Set(sel);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  return next;
}

/**
 * Toggle a whole section — the header action.
 *
 * All-or-nothing against what is CURRENTLY on: if every id in the section is
 * already selected, the header clears them; otherwise it selects the ones that
 * are missing (and leaves the already-on ones on). That makes a half-selected
 * section fill up on the first tap and empty on the second, which is the
 * behaviour a tri-state header implies.
 */
export function toggleSection(sel: Selection, ids: readonly EntryId[]): Set<EntryId> {
  const next = new Set(sel);
  if (ids.length > 0 && ids.every((id) => next.has(id))) {
    for (const id of ids) next.delete(id);
  } else {
    for (const id of ids) next.add(id);
  }
  return next;
}

/** How a section header should read: none / some / all of its entries selected.
 * Empty sections are "none" — there is nothing to have selected. */
export function sectionState(
  sel: Selection,
  ids: readonly EntryId[],
): "none" | "some" | "all" {
  if (ids.length === 0) return "none";
  let on = 0;
  for (const id of ids) if (sel.has(id)) on++;
  if (on === 0) return "none";
  return on === ids.length ? "all" : "some";
}

/**
 * SHIFT-CLICK RANGE SELECT — the desktop gesture, over the Library's flat set.
 *
 * A plain click sets an ANCHOR (the page tracks which id that is); Shift-clicking
 * another item selects everything between the anchor and that item. The two
 * functions here are the pure math of that gesture, kept out of the component so
 * they can be tested against real ordered id lists.
 *
 * `visible` is the entries CURRENTLY ON SCREEN, in DISPLAY ORDER — already cut by
 * the kind filter, the knowledge-state filter and the search box, and already
 * past each section's render cap. The range is a slice of THAT list, so it can
 * never reach a hidden, filtered-out or capped-off entry: if you cannot see it,
 * a Shift-click cannot select it.
 *
 * CROSS-SHELF / CROSS-SECTION BEHAVIOUR IS DELIBERATE. `visible` is the flattened
 * order of every on-screen tile and row, ACROSS section (and, in search, across
 * kind) boundaries — the browse shelf shows one kind at a time, so the boundaries
 * a range crosses are its sections (kana rows, kanji hundreds), and search stacks
 * sections of different kinds. A range from an anchor in one section to a target
 * in another therefore fills every visible item between them, section dividers
 * and all, which is what "drag-select from here to there" means on a page you
 * read top to bottom. The selection set is already flat and cross-kind (see the
 * file header), so this needs no per-section bucket to express.
 */

/**
 * The ids in `visible` from `anchor` to `target` inclusive, in display order —
 * the contiguous run a Shift-click turns on. Works in BOTH directions: it does
 * not matter whether the anchor sits before or after the target on screen.
 *
 * Returns `[]` when either id is absent from the visible list. That is the
 * anchor-scrolled-away case (a filter or the search box changed what is visible
 * since the anchor was set) and the never-visible-target case; the caller falls
 * back to a plain toggle so a Shift-click is never a no-op that looks broken.
 */
export function rangeIds(
  visible: readonly EntryId[],
  anchor: EntryId,
  target: EntryId,
): EntryId[] {
  const a = visible.indexOf(anchor);
  const b = visible.indexOf(target);
  if (a === -1 || b === -1) return [];
  const [lo, hi] = a <= b ? [a, b] : [b, a];
  return visible.slice(lo, hi + 1);
}

/**
 * Shift-click applied: the current selection UNIONED with the visible range from
 * anchor to target. Additive on purpose — the Library builds a drill by turning
 * things ON, so a range never clears what you had selected elsewhere; it only
 * adds the run between the two clicks. Entries already in the range stay on.
 *
 * If no range can be formed (anchor or target not currently visible) the target
 * is toggled instead, so the click still does the obvious thing and re-anchors.
 */
export function addRange(
  sel: Selection,
  visible: readonly EntryId[],
  anchor: EntryId,
  target: EntryId,
): Set<EntryId> {
  const range = rangeIds(visible, anchor, target);
  if (range.length === 0) return toggleEntry(sel, target);
  const next = new Set(sel);
  for (const id of range) next.add(id);
  return next;
}

/**
 * The selection as a Slice, so the one bar can drill / claim / file it exactly
 * like any other slice — no second code path for "the drill you built".
 *
 * Entries come out in `all`'s order (the app's browse order: kana, kanji,
 * words), NOT in click order, so the slice is stable no matter how you assembled
 * it. The label is the running count the owner asked for; the bar appends its
 * own sentence, so "3 selected — everything here that isn't solid · 9 questions".
 */
export function selectionSlice(sel: Selection, all: readonly LibEntry[]): Slice {
  const entries = all.filter((e) => sel.has(e.id)).map((e) => e.id);
  return {
    label: `${entries.length} selected`,
    entries,
  };
}

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

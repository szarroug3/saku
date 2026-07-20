// The four "What to practise" presets, as pure Selection values.
//
// Practice option A does not carry the Library's granular kind/state/list
// picker. It offers a handful of ready-made pools and, for anything finer, a
// door to the Library. Each preset is just a Selection (see selection.ts), so
// the same resolve() that powers the Library and the old query card counts and
// runs them — a preset is a saved query, not a second code path.
//
// The presets:
//   everything .. everything you've seen or claimed (the empty query).
//   shaky ....... the bands that need work: shaky, slipping and mix-ups. NOT
//                 `new` (never drilled) and NOT `solid` (nothing to gain today).
//   list ........ one saved list, by id.
// "Pick exactly what I want" is not a preset — it is a link to the Library,
// where an arbitrary selection is built and drilled directly.

import { emptySelection } from "@/lib/selection-empty";
import type { FactBand, Selection } from "@/types";

/** The bands "Just the shaky ones" covers: everything that needs work, which is
 * neither `new` (you haven't met it) nor `solid` (asking gains nothing today).
 * `mixup` overlaps the others and is included because a confusion IS shaky. */
export const SHAKY_BANDS: readonly FactBand[] = ["shaky", "slipping", "mixup"];

export type PresetKind = "everything" | "shaky" | "list" | "custom";

export function everythingSelection(): Selection {
  return emptySelection();
}

export function shakySelection(): Selection {
  return { ...emptySelection(), states: [...SHAKY_BANDS] };
}

export function listSelection(listId: string): Selection {
  return { ...emptySelection(), list: listId };
}

function sameSet<T>(a: readonly T[], b: readonly T[]): boolean {
  if (a.length !== b.length) return false;
  const set = new Set(a);
  return b.every((x) => set.has(x));
}

/** True when a Selection is exactly this preset and nothing more — so a preset
 * lights up only when it fully describes the current pool, never when it happens
 * to share one field with a richer query. */
function isEverything(sel: Selection): boolean {
  return (
    !sel.subjects.length &&
    !sel.states.length &&
    !sel.list &&
    !sel.text.trim() &&
    sel.session === null
  );
}

function isShaky(sel: Selection): boolean {
  return (
    !sel.subjects.length &&
    !sel.list &&
    !sel.text.trim() &&
    sel.session === null &&
    sameSet(sel.states, SHAKY_BANDS)
  );
}

function isList(sel: Selection, listId: string): boolean {
  return (
    sel.list === listId &&
    !sel.subjects.length &&
    !sel.states.length &&
    !sel.text.trim() &&
    sel.session === null
  );
}

/** Which preset the current selection is, if any. `custom` means the stored
 * selection matches no preset (an older query, or a session rerun) — the tiles
 * then highlight nothing, and Start still runs whatever is stored. */
export function activePreset(
  sel: Selection,
  listIds: readonly string[],
): { kind: PresetKind; listId?: string } {
  if (isEverything(sel)) return { kind: "everything" };
  if (isShaky(sel)) return { kind: "shaky" };
  const match = listIds.find((id) => isList(sel, id));
  if (match) return { kind: "list", listId: match };
  return { kind: "custom" };
}

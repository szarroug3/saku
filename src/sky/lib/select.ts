// A selection over an ordered set of tiles, as plain data (SAK-458).
//
// What is picked, and the tile a range is drawn from. The Atlas holds one of
// these in `useSelection`; the Observatory keeps the same pair of values for
// its own picks, which follow the cart's rules and so are not built here.
// Both take "Unselect all" from `NOTHING`, and the rules of picking are
// functions rather than a hook so they can be tested without a browser.

/** How a tile was clicked: plain selects one, toggle adds or removes one,
 * range takes the run from the anchor to this one. */
export interface PickHow {
  toggle: boolean;
  range: boolean;
}

interface SelectionState {
  /** What is picked, in the order it was picked. */
  ids: readonly string[];
  /** The tile the next range is drawn from: the last one picked or toggled,
   * and never a tile a range merely ran over. */
  anchor: string | null;
}

/**
 * Nothing picked: where a page starts, and what "Unselect all" leaves.
 *
 * Everything goes, not only what is on screen: the Atlas keeps one selection
 * across its shelves, its cuts and its search results, so a tile picked on a
 * shelf nobody is looking at is dropped with the rest.
 *
 * The anchor goes too. It used to stay behind, so a shift-click after the
 * panel was closed drew its range from a tile that had not been picked since,
 * and the click selected a run the learner never asked for.
 */
export const NOTHING: SelectionState = { ids: [], anchor: null };

/** Exactly this one picked, and ranges drawn from it. */
export function justThis(id: string): SelectionState {
  return { ids: [id], anchor: id };
}

/** The selection after a click on `id`, given the tiles in the order they are
 * on screen. A range adds the whole run from the anchor and leaves the anchor
 * where it was; anything else moves the anchor to what was clicked. */
export function afterPick(state: SelectionState, order: readonly string[], id: string, how: PickHow): SelectionState {
  if (how.range && state.anchor) {
    const from = order.indexOf(state.anchor), to = order.indexOf(id);
    if (from >= 0 && to >= 0) {
      const run = order.slice(Math.min(from, to), Math.max(from, to) + 1);
      return { ids: [...new Set([...state.ids, ...run])], anchor: state.anchor };
    }
  }
  if (how.toggle) {
    return { ids: state.ids.includes(id) ? state.ids.filter((x) => x !== id) : [...state.ids, id], anchor: id };
  }
  return justThis(id);
}

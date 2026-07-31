// The pure list-membership helpers — everything a caller can answer about a
// SavedList it already holds, with no React and no fetch. They used to sit in
// use-lists.ts next to the hook, but that file imports the client-only
// ListsProvider, which the node test runner can't load; splitting them out lets
// the popover and its tests ask the same functions the same question.

import type { EntryId, SavedList } from "@/types";

/**
 * Can you add to it? The one question the two kinds answer differently, asked
 * as a function so that no call site re-derives it from `kind` and gets the
 * polarity backwards.
 *
 * The server refuses a write to a derived list at the one place a write can
 * happen (see lists.ts); this is the UI's half of the same rule, and it exists
 * so the popover can decline to OFFER what the server would refuse. Two guards,
 * one model — the server's is the one that must be right.
 */
export function isWritable(
  list: SavedList,
): list is Extract<SavedList, { kind: "fixed" }> {
  return list.kind === "fixed";
}

/**
 * The add-to-list ROW as a toggle, decided from the indicator it already shows.
 *
 * A row's mark is truthful about how many of `entries` are in `list`: ✓ all, –
 * some, blank none. This turns that same fact into the one action a click
 * should take, so the indicator and the behaviour cannot disagree:
 *
 *   all present (✓)  → REMOVE them all (→ blank). The one place a click undoes.
 *   otherwise        → ADD the slice (→ ✓). Empty fills; partial completes.
 *
 * Both underlying writes are idempotent (addToList skips members it has,
 * removeFromList skips ones it hasn't), so handing the WHOLE slice either way is
 * safe — the partial case adds the missing ones without disturbing the present.
 *
 * Pure and free-standing, like countIn: it reads only its arguments, so the
 * popover and its test ask the same function what a click means.
 */
export interface ListToggle {
  kind: "add" | "remove";
  entries: EntryId[];
}

export function listToggle(
  list: SavedList,
  entries: readonly EntryId[],
): ListToggle {
  const have = countIn(list, entries);
  const allPresent = entries.length > 0 && have === entries.length;
  return { kind: allPresent ? "remove" : "add", entries: [...entries] };
}

/** How many of `entries` are already in `list` — the popover's tick/dash/blank.
 * Free function rather than a hook member: it reads nothing but its arguments,
 * and a caller holding a list already has everything it needs. */
export function countIn(
  list: SavedList,
  entries: readonly EntryId[],
): number {
  if (!isWritable(list)) return 0;
  const have = new Set<EntryId>(list.entries);
  let n = 0;
  for (const e of entries) if (have.has(e)) n++;
  return n;
}

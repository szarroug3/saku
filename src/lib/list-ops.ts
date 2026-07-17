// Pure list mutations — the arithmetic of "what does this write DO to a list",
// with no filesystem and no `server-only` on it.
//
// lists.ts is the fs half: load → apply → write. It is `server-only` and so
// cannot be imported by a test (the marker package throws in plain Node). The
// decisions worth testing — a derived list refuses entry writes, a rename trims
// and never blanks a name, an add dedups — are here, where a test can reach
// them, and lists.ts calls straight through so the two cannot diverge.

import type { EntryId, SavedList } from "@/types";

/**
 * Entries added to a FIXED list, deduped. A DERIVED list is a rule, not a set,
 * so it comes back untouched — the same guard addToList/removeFromList enforce,
 * stated once here. Returns a new object; the caller writes it.
 */
export function withEntriesAdded(
  list: SavedList,
  entries: readonly EntryId[],
): SavedList {
  if (list.kind !== "fixed") return list;
  const have = new Set(list.entries);
  const next = [...list.entries];
  for (const e of entries) {
    if (!have.has(e)) {
      next.push(e);
      have.add(e);
    }
  }
  return { ...list, entries: next };
}

/**
 * Entries dropped from a FIXED list. Derived lists are untouched (no member to
 * drop from a rule). Idempotent: entries the list never had change nothing.
 */
export function withEntriesRemoved(
  list: SavedList,
  entries: readonly EntryId[],
): SavedList {
  if (list.kind !== "fixed") return list;
  const drop = new Set(entries);
  return { ...list, entries: list.entries.filter((e) => !drop.has(e)) };
}

/**
 * A list relabelled. Allowed on EITHER kind — a name is a label, not a member.
 * An empty or whitespace-only name is refused (the list keeps its name) so a
 * list can never lose the only thing that identifies it on screen.
 */
export function withName(list: SavedList, name: string): SavedList {
  const trimmed = name.trim();
  return trimmed ? { ...list, name: trimmed } : list;
}

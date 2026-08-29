// Pure list mutations — the arithmetic of "what does this write DO to a list",
// with no filesystem and no `server-only` on it.
//
// lists.ts is the fs half: load → apply → write. It is `server-only` and so
// cannot be imported by a test (the marker package throws in plain Node). The
// decisions worth testing — a derived list refuses entry writes, a rename trims
// and never blanks a name, an add dedups — are here, where a test can reach
// them, and lists.ts calls straight through so the two cannot diverge.

import type { EntryId, ListsFile, SavedList } from "@/types";

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

// ---------- whole-file ops ----------
//
// The five above answer "what does this write do to ONE list". These answer the
// same question for the whole file, and exist because the file is what gets
// written to the shared row — under compare-and-set, an op has to be RE-APPLIED
// to whatever a concurrent writer left behind (see lists-mutate.ts), so it must
// be a pure ListsFile → ListsFile function and not a mutation of a loaded copy.
//
// Each one is keyed by list id and touches only that list, which is why
// re-applying is safe: a retry adds our list to the winner's file instead of
// replacing it. And each returns the SAME reference when nothing changed, so a
// write that would be a no-op never touches the row (and never makes another
// writer retry for an edit with no effect).

/** A list added, or the one with the same id replaced. */
export function withListSaved(file: ListsFile, list: SavedList): ListsFile {
  const i = file.lists.findIndex((l) => l.id === list.id);
  if (i === -1) return { ...file, lists: [...file.lists, list] };
  if (file.lists[i] === list) return file;
  const lists = file.lists.slice();
  lists[i] = list;
  return { ...file, lists };
}

/** One list replaced by `op`'s result, by id. The shared spine of the four
 * per-list writes below: a missing id changes nothing, and an op that returns
 * the list it was given (a derived list refusing entries, a blank rename)
 * changes nothing either — both come back as the SAME file. */
function withListMapped(
  file: ListsFile,
  id: string,
  op: (list: SavedList) => SavedList,
): ListsFile {
  const i = file.lists.findIndex((l) => l.id === id);
  if (i === -1) return file;
  const next = op(file.lists[i]);
  if (next === file.lists[i]) return file;
  const lists = file.lists.slice();
  lists[i] = next;
  return { ...file, lists };
}

/** Entries added to one fixed list, by id. */
export function withListEntriesAdded(
  file: ListsFile,
  id: string,
  entries: readonly EntryId[],
): ListsFile {
  return withListMapped(file, id, (l) => withEntriesAdded(l, entries));
}

/** Entries dropped from one fixed list, by id. */
export function withListEntriesRemoved(
  file: ListsFile,
  id: string,
  entries: readonly EntryId[],
): ListsFile {
  return withListMapped(file, id, (l) => withEntriesRemoved(l, entries));
}

/** One list relabelled, by id. */
export function withListRenamed(
  file: ListsFile,
  id: string,
  name: string,
): ListsFile {
  return withListMapped(file, id, (l) => withName(l, name));
}

/** One list dropped, by id. An id that is not there changes nothing. */
export function withListDeleted(file: ListsFile, id: string): ListsFile {
  const lists = file.lists.filter((l) => l.id !== id);
  return lists.length === file.lists.length ? file : { ...file, lists };
}

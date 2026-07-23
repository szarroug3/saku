// Server-side persistence for saved lists.
//
// WHERE A LIST LIVES depends on STORAGE_BACKEND (see store/mode.ts): the local
// lists.json at the repo root in file mode, or the per-user `lists` jsonb blob
// in Supabase in hosted mode. The read-modify-write LOGIC below is unchanged
// from when this was file-only; what's new is the async + `userId` threading and
// the one-line backend branch in loadLists / writeLists.
//
// Still a separate blob from history rather than a key inside it, for the same
// reason it was a separate file: history is rewritten on every finished session
// and rebuilt wholesale by deleteSessions(). Lists outlive all of that and must
// not be collateral in a "delete all my history" that was never about them.

import "server-only";

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import path from "node:path";

import { withEntriesAdded, withEntriesRemoved, withName } from "@/lib/list-ops";
import { isSupabaseStore } from "@/lib/store/mode";
import { readListsRow, writeListsRow } from "@/lib/store/supabase-store";
import type { EntryId, ListsFile, SavedList } from "@/types";

const LISTS_PATH = path.join(process.cwd(), "lists.json");

/** Indent 1, no trailing newline — legible under `git diff`, which is the only
 * reason the formatting is specified at all. Same rule as history.ts. */
function writeListsFile(file: ListsFile): void {
  writeFileSync(LISTS_PATH, JSON.stringify(file, null, 1), "utf-8");
}

function readListsFile(): ListsFile {
  if (existsSync(LISTS_PATH)) {
    try {
      const raw = JSON.parse(readFileSync(LISTS_PATH, "utf-8")) as
        | Partial<ListsFile>
        | null;
      return { lists: raw?.lists ?? [] };
    } catch {
      // missing/corrupt file yields no lists, same as history
    }
  }
  return { lists: [] };
}

/** The current backend's lists for `userId`. File mode ignores the id (one
 * lists.json); Supabase reads the user's own row under RLS. */
export async function loadLists(userId: string): Promise<ListsFile> {
  return isSupabaseStore() ? readListsRow(userId) : readListsFile();
}

async function writeLists(userId: string, file: ListsFile): Promise<void> {
  if (isSupabaseStore()) await writeListsRow(userId, file);
  else writeListsFile(file);
}

/** Add a list, or replace the one with the same id. */
export async function saveList(userId: string, list: SavedList): Promise<ListsFile> {
  const file = await loadLists(userId);
  const i = file.lists.findIndex((l) => l.id === list.id);
  if (i === -1) file.lists.push(list);
  else file.lists[i] = list;
  await writeLists(userId, file);
  return file;
}

/**
 * Add entries to a FIXED list. Returns the file unchanged if the list is
 * derived or missing.
 *
 * The guard is the model, not defensiveness. A derived list is a rule, and
 * writing to a rule either loses your addition on the next recompute or
 * silently freezes your live search — so it is refused inside withEntriesAdded,
 * the one tested pure op that owns "what an add DOES to a list". The fs/db half
 * calls straight through so the two can't diverge (which they once did).
 */
export async function addToList(
  userId: string,
  id: string,
  entries: EntryId[],
): Promise<ListsFile> {
  const file = await loadLists(userId);
  const i = file.lists.findIndex((l) => l.id === id);
  if (i !== -1) file.lists[i] = withEntriesAdded(file.lists[i], entries);
  await writeLists(userId, file);
  return file;
}

/**
 * Drop entries from a FIXED list — the other half of addToList, and refused on
 * derived lists for the same reason: a derived list is a rule, not a set, so
 * there is no member to take out. Idempotent: entries not present are simply
 * absent from the result, so a second removal is a no-op.
 */
export async function removeFromList(
  userId: string,
  id: string,
  entries: EntryId[],
): Promise<ListsFile> {
  const file = await loadLists(userId);
  const i = file.lists.findIndex((l) => l.id === id);
  if (i !== -1) file.lists[i] = withEntriesRemoved(file.lists[i], entries);
  await writeLists(userId, file);
  return file;
}

/**
 * Rename a list. Allowed on EITHER kind: a name is a label, not a member, so
 * renaming a derived list changes nothing the rule depends on. An empty name is
 * refused inside withName rather than stored, so a list can never lose the only
 * thing that identifies it on screen.
 */
export async function renameList(
  userId: string,
  id: string,
  name: string,
): Promise<ListsFile> {
  const file = await loadLists(userId);
  const i = file.lists.findIndex((l) => l.id === id);
  if (i !== -1) file.lists[i] = withName(file.lists[i], name);
  await writeLists(userId, file);
  return file;
}

export async function deleteList(userId: string, id: string): Promise<ListsFile> {
  const file = await loadLists(userId);
  file.lists = file.lists.filter((l) => l.id !== id);
  await writeLists(userId, file);
  return file;
}

// Server-side persistence for a signed-in learner's saved lists — the `lists`
// jsonb on their `progress` row.
//
// WHO REACHES THIS. Only a signed-in request (getUserId → 401 otherwise). A
// signed-out visitor's lists live in this browser's localStorage (see
// store/local-progress.ts), applied with the same pure list-ops this file uses.
//
// Still a separate blob from history rather than a key inside it, for the same
// reason it was a separate file: history is rewritten on every finished session
// and rebuilt wholesale by deleteSessions(). Lists outlive all of that and must
// not be collateral in a "delete all my history" that was never about them.
//
// EVERY MUTATOR GOES THROUGH COMPARE-AND-SET. These used to be load → mutate the
// loaded copy → upsert the whole blob, which let two overlapping writes clobber
// each other (two devices signing in at once wiped one device's lists outright —
// see lists-mutate.ts). Each write is now a PURE op re-applied against whatever
// a concurrent writer left behind, so a lost race merges instead of overwriting.

import "server-only";

import {
  withListDeleted,
  withListEntriesAdded,
  withListEntriesRemoved,
  withListRenamed,
  withListSaved,
} from "@/lib/list-ops";
import { mutateListsWithRetry, type ListsStore } from "@/lib/lists-mutate";
import {
  readListsRow,
  readListsRowVersioned,
  writeListsRowGuarded,
} from "@/lib/store/supabase-store";
import type { EntryId, ListsFile, SavedList } from "@/types";

/** The compare-and-set store the mutators below run their read-modify-write
 * through, so two overlapping requests cannot clobber each other's lists. One
 * instance, since it is stateless — the request-bound Supabase client is created
 * per call inside these primitives. The twin of history.ts's `store`. */
const store: ListsStore = {
  read: readListsRowVersioned,
  write: writeListsRowGuarded,
};

/**
 * Apply a pure op to this user's lists and persist it, safe against a concurrent
 * writer. The one seam every mutator below shares.
 *
 * An op that changed nothing writes nothing (the ops return the SAME file
 * reference), which preserves what the old code did by accident for a missing or
 * derived list and now does deliberately: an add to a list that is not there
 * must not churn the row.
 */
function mutateLists(
  userId: string,
  op: (file: ListsFile) => ListsFile,
): Promise<ListsFile> {
  return mutateListsWithRetry(store, userId, op);
}

/** The signed-in learner's lists. readListsRow normalizes an unset column into
 * no lists. */
export async function loadLists(userId: string): Promise<ListsFile> {
  return readListsRow(userId);
}

/** Add a list, or replace the one with the same id. */
export async function saveList(userId: string, list: SavedList): Promise<ListsFile> {
  return mutateLists(userId, (file) => withListSaved(file, list));
}

/**
 * Add entries to a FIXED list. Returns the file unchanged if the list is
 * derived or missing.
 *
 * The guard is the model, not defensiveness. A derived list is a rule, and
 * writing to a rule either loses your addition on the next recompute or
 * silently freezes your live search — so it is refused inside withEntriesAdded,
 * the one tested pure op that owns "what an add DOES to a list". The db half
 * calls straight through so the two can't diverge (which they once did).
 */
export async function addToList(
  userId: string,
  id: string,
  entries: EntryId[],
): Promise<ListsFile> {
  return mutateLists(userId, (file) => withListEntriesAdded(file, id, entries));
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
  return mutateLists(userId, (file) => withListEntriesRemoved(file, id, entries));
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
  return mutateLists(userId, (file) => withListRenamed(file, id, name));
}

export async function deleteList(userId: string, id: string): Promise<ListsFile> {
  return mutateLists(userId, (file) => withListDeleted(file, id));
}

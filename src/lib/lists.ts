// Server-side persistence for saved lists — lists.json, next to history.json.
//
// STORAGE IS A NON-QUESTION, and this file is short because of it. history.ts
// already settled the argument: "Git IS the sync — that part stands, and it is
// why this stays a plain file at the repo root rather than growing a database."
// A list is the same kind of thing as a session record, so it lives the same
// way, in the same folder, under the same sync.
//
// What that buys, all of it for free:
//   - No 5MB budget. A file is a file. An imported 10k-word deck is ~200KB of
//     JSON and nothing anywhere has an opinion about it.
//   - No sync feature, no conflict resolution, no account, no server. There is
//     no second device to reconcile with; there is a git remote, and it already
//     works.
//   - No migration story. The data is disposable, exactly as history.json's is.
//
// Separate FILE from history.json rather than a key inside it, for one reason:
// history is written on every finished session and rebuilt wholesale by
// deleteSessions(). Lists outlive all of that and must not be collateral in a
// "delete all my history" that was never about them.

import "server-only";

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import path from "node:path";

import type { EntryId, ListsFile, SavedList } from "@/types";

const LISTS_PATH = path.join(process.cwd(), "lists.json");

/** Indent 1, no trailing newline — legible under `git diff`, which is the only
 * reason the formatting is specified at all. Same rule as history.ts. */
function write(file: ListsFile): void {
  writeFileSync(LISTS_PATH, JSON.stringify(file, null, 1), "utf-8");
}

export function loadLists(): ListsFile {
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

/** Add a list, or replace the one with the same id. */
export function saveList(list: SavedList): ListsFile {
  const file = loadLists();
  const i = file.lists.findIndex((l) => l.id === list.id);
  if (i === -1) file.lists.push(list);
  else file.lists[i] = list;
  write(file);
  return file;
}

/**
 * Add entries to a FIXED list. Returns the file unchanged if the list is
 * derived or missing.
 *
 * The guard is the model, not defensiveness. A derived list is a rule, and
 * writing to a rule either loses your addition on the next recompute or
 * silently freezes your live search — so it is refused here, at the one place
 * a write can happen, rather than trusted to every caller. The UI does not
 * offer derived lists for adding (see the Add-to-list popover), and this is
 * why that stays true even if a caller forgets.
 */
export function addToList(id: string, entries: EntryId[]): ListsFile {
  const file = loadLists();
  const list = file.lists.find((l) => l.id === id);
  if (!list || list.kind !== "fixed") return file;
  const have = new Set(list.entries);
  for (const e of entries) {
    if (!have.has(e)) {
      list.entries.push(e);
      have.add(e);
    }
  }
  write(file);
  return file;
}

export function deleteList(id: string): ListsFile {
  const file = loadLists();
  file.lists = file.lists.filter((l) => l.id !== id);
  write(file);
  return file;
}

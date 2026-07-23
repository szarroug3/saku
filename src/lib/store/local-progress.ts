"use client";

// The signed-out learner's progress, kept in THIS browser's localStorage.
//
// THE PROBLEM THIS SOLVES
// =======================
// In Supabase mode a signed-out learner has no server row to write to, so every
// progress write — "I know these", "quiz me", a finished quiz, a delete, a list
// edit — comes back 401 (see AuthRequiredError → historyErrorResponse). Before
// this, that meant the write silently vanished and the button looked broken. Now
// a 401 falls back to here: the same operation is applied to a localStorage copy
// instead, so the signed-out app behaves exactly as if it saved — because it
// did, locally. When the learner signs in, migrate-local.ts replays this copy up
// into the account and clears it.
//
// A DISPOSABLE CACHE, NOT A DURABLE COPY
// ======================================
// This is the OPPOSITE of history.ts's contract, on purpose. history.json is the
// one durable copy and unparseable bytes there THROW rather than read as empty,
// because reading them as empty and then writing over them is total loss. Here,
// corrupt or unreadable local data is treated as EMPTY and quietly overwritten:
// the durable copy is the account you sign into, this is a browser-local
// convenience that a learner can lose by clearing site data and has not lost
// anything that was ever promised to be kept. So every access is wrapped in
// try/catch, and any failure — SSR (no `window`), private-mode quota, a JSON
// parse error, a shape that is not a history — degrades to "start from empty"
// rather than throwing into a click handler.
//
// PURE TRANSFORMS, SHARED WITH THE SERVER
// =======================================
// The mutators below do NOT reimplement what a claim or a session or a delete
// means — they read the local blob, hand it to the SAME pure op the server file
// calls (history-ops.ts / list-ops.ts), and write the result back. That is what
// keeps a signed-out "I know these" identical to a signed-in one, down to the
// timestamp-forward re-claim and the session id-dedupe, so the merge on sign-in
// lands where it would have landed had the learner been signed in all along.

import {
  applyClaims,
  applyDeleteSessions,
  applyDropClaims,
  applySeen,
  applySession,
  emptyHistory,
} from "@/lib/history-ops";
import {
  withEntriesAdded,
  withEntriesRemoved,
  withName,
} from "@/lib/list-ops";
import type {
  EntryId,
  FactId,
  HistoryFile,
  ListsFile,
  QuizSessionRecord,
  SavedList,
} from "@/types";

/** This browser's signed-out history and lists. Namespaced `saku-local-` so they
 * read as "local, awaiting an account" beside the app's other localStorage keys
 * (the quiz snapshot, the pending outbox, the theme), none of which they touch. */
export const LOCAL_HISTORY_KEY = "saku-local-history";
export const LOCAL_LISTS_KEY = "saku-local-lists";

/** localStorage or null when there is none (SSR, or a browser that blocks it).
 * One place asks the question so every reader and writer degrades the same way. */
function storage(): Storage | null {
  try {
    if (typeof window === "undefined") return null;
    return window.localStorage;
  } catch {
    // Some privacy modes throw on the `localStorage` getter itself.
    return null;
  }
}

/** Read and parse a namespaced blob, or return `fallback` for anything that is
 * not there / not readable / not JSON. The disposable-cache rule, in one place. */
function read<T>(key: string, fallback: T): T {
  const s = storage();
  if (!s) return fallback;
  try {
    const raw = s.getItem(key);
    if (!raw) return fallback;
    const parsed: unknown = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? (parsed as T) : fallback;
  } catch {
    return fallback;
  }
}

/** Write a namespaced blob. Silent on failure — a full or blocked storage is not
 * something a signed-out learner's click can do anything about, and throwing
 * here would break the very button we are trying to make work. The account is
 * the durable copy; this is best effort. */
function write(key: string, value: unknown): void {
  const s = storage();
  if (!s) return;
  try {
    s.setItem(key, JSON.stringify(value));
  } catch {
    // out of quota, or storage disabled after the read — nothing to do
  }
}

// ---------- history ----------

/**
 * This browser's signed-out history. Always a well-formed HistoryFile: a missing
 * or corrupt blob reads as the day-one shell, never as a throw. `normalizeHistory`
 * fills the optional keys so callers can index `.claims`/`.seen` without guards,
 * matching what the server's readers already assume.
 */
export function loadLocalHistory(): HistoryFile {
  return normalizeHistory(read<Partial<HistoryFile>>(LOCAL_HISTORY_KEY, {}));
}

/** Coerce whatever came out of storage into the four containers a HistoryFile
 * promises. Mirrors normalizeHistory in supabase-store.ts — a blob written by an
 * older build, or half-corrupted, still reads as a usable (possibly empty)
 * history rather than crashing a screen. */
function normalizeHistory(h: Partial<HistoryFile>): HistoryFile {
  return {
    sessions: Array.isArray(h.sessions) ? h.sessions : [],
    facts: h.facts ?? {},
    claims: h.claims ?? {},
    seen: h.seen ?? {},
  };
}

/** Apply one op to the local history, persist it, and return the new file — the
 * read → op → write shape every mutator below shares, so the persistence and the
 * "always return the new state" contract live in one place. */
function mutateHistory(
  op: (hist: HistoryFile) => HistoryFile,
): HistoryFile {
  const next = op(loadLocalHistory());
  write(LOCAL_HISTORY_KEY, next);
  return next;
}

/** "I know these", locally. Mirrors POST /api/claim with `known` truthy. */
export function localClaim(facts: FactId[], ts: number): HistoryFile {
  return mutateHistory((h) => applyClaims(h, facts, ts));
}

/** "Actually, I don't", locally. Mirrors POST /api/claim with `known: false`. */
export function localDropClaim(facts: FactId[]): HistoryFile {
  return mutateHistory((h) => applyDropClaims(h, facts));
}

/** "Quiz me", locally. Mirrors POST /api/seen. */
export function localSeen(facts: FactId[], ts: number): HistoryFile {
  return mutateHistory((h) => applySeen(h, facts, ts));
}

/** A finished round, locally. Mirrors POST /api/session — same id-dedupe, so a
 * double-committed round counts once here too. */
export function localSession(record: QuizSessionRecord): HistoryFile {
  return mutateHistory((h) => applySession(h, record));
}

/** Drop sessions (by id/ts) or all, locally. Mirrors POST /api/delete without
 * `reset`. */
export function localDeleteSessions(
  ids: (number | string)[] | null,
  all: boolean,
): HistoryFile {
  return mutateHistory((h) => applyDeleteSessions(h, ids, all));
}

/** Full wipe, locally. Mirrors POST /api/delete with `reset: true`: the day-one
 * shell, claims and seen gone with everything else. */
export function localResetHistory(): HistoryFile {
  const empty = emptyHistory();
  write(LOCAL_HISTORY_KEY, empty);
  return empty;
}

// ---------- lists ----------

/** This browser's signed-out lists. Corrupt or missing reads as no lists. */
export function loadLocalLists(): SavedList[] {
  const file = read<Partial<ListsFile>>(LOCAL_LISTS_KEY, {});
  return Array.isArray(file.lists) ? file.lists : [];
}

/** Apply one op to the local lists, persist, and return the new array. */
function mutateLists(op: (lists: SavedList[]) => SavedList[]): SavedList[] {
  const next = op(loadLocalLists());
  write(LOCAL_LISTS_KEY, { lists: next });
  return next;
}

/** Add a list, or replace the one with the same id. Mirrors saveList. */
export function localSaveList(list: SavedList): SavedList[] {
  return mutateLists((lists) => {
    const i = lists.findIndex((l) => l.id === list.id);
    if (i === -1) return [...lists, list];
    const next = lists.slice();
    next[i] = list;
    return next;
  });
}

/** Add entries to a FIXED list — the derived-list guard lives in withEntriesAdded,
 * so a rule is returned untouched here exactly as the server refuses it. */
export function localAddToList(id: string, entries: EntryId[]): SavedList[] {
  return mutateLists((lists) =>
    lists.map((l) => (l.id === id ? withEntriesAdded(l, entries) : l)),
  );
}

/** Drop entries from a FIXED list. Mirrors removeFromList. */
export function localRemoveFromList(id: string, entries: EntryId[]): SavedList[] {
  return mutateLists((lists) =>
    lists.map((l) => (l.id === id ? withEntriesRemoved(l, entries) : l)),
  );
}

/** Relabel a list — allowed on either kind, empty name refused (withName). */
export function localRenameList(id: string, name: string): SavedList[] {
  return mutateLists((lists) =>
    lists.map((l) => (l.id === id ? withName(l, name) : l)),
  );
}

/** Delete a whole list. Mirrors deleteList. */
export function localDeleteList(id: string): SavedList[] {
  return mutateLists((lists) => lists.filter((l) => l.id !== id));
}

// ---------- migration bookkeeping ----------

/** Is there anything worth replaying into a freshly signed-in account? Cheap
 * enough to ask on every authed mount (see migrate-local.ts) and the guard that
 * keeps the merge from running when a signed-out session touched nothing. */
export function hasLocalProgress(): boolean {
  const h = loadLocalHistory();
  if (
    h.sessions.length ||
    Object.keys(h.claims ?? {}).length ||
    Object.keys(h.seen ?? {}).length
  ) {
    return true;
  }
  return loadLocalLists().length > 0;
}

/** Forget the local history — called ONLY after its uploads succeed (see
 * migrate-local.ts). Best effort: a failure here just means the merge runs again
 * next load and re-uploads idempotently, which is harmless. */
export function clearLocalHistory(): void {
  const s = storage();
  try {
    s?.removeItem(LOCAL_HISTORY_KEY);
  } catch {
    // nothing to do — a stale copy re-migrates idempotently next time
  }
}

/** Forget the local lists — called ONLY after their uploads succeed. */
export function clearLocalLists(): void {
  const s = storage();
  try {
    s?.removeItem(LOCAL_LISTS_KEY);
  } catch {
    // as clearLocalHistory
  }
}

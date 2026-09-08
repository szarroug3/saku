"use client";

// The signed-out learner's progress, kept in THIS browser's localStorage.
//
// THE PROBLEM THIS SOLVES
// =======================
// In Supabase mode a signed-out learner has no server row to write to, so every
// progress write — "I know these", "quiz me", a finished quiz, a delete —
// comes back 401 (see AuthRequiredError → historyErrorResponse). Before
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
// calls (history-ops.ts), and write the result back. That is what
// keeps a signed-out "I know these" identical to a signed-in one, down to the
// timestamp-forward re-claim and the session id-dedupe, so the merge on sign-in
// lands where it would have landed had the learner been signed in all along.

import {
  applyClearMixup,
  applyClaims,
  applyDeleteSessions,
  applyDropClaims,
  applyDropSeen,
  applySeen,
  applySession,
  emptyHistory,
  normalizeHistoryShell,
} from "@/lib/history-ops";
import type { FactId, HistoryFile, QuizSessionRecord } from "@/types";

/** This browser's signed-out history. Namespaced `saku-local-` so it reads as
 * "local, awaiting an account" beside the app's other localStorage keys (the
 * quiz snapshot, the pending outbox, the theme), none of which it touches. */
export const LOCAL_HISTORY_KEY = "saku-local-history";

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
 * or corrupt blob reads as the day-one shell, never as a throw. `normalizeHistoryShell`
 * (history-ops.ts, shared with the server's legacy reader — see SAK-251) fills
 * the optional keys so callers can index `.claims`/`.seen` without guards,
 * matching what the server's readers already assume.
 */
export function loadLocalHistory(): HistoryFile {
  return normalizeHistoryShell(read<Partial<HistoryFile>>(LOCAL_HISTORY_KEY, {}));
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

/** Withdraw seen marks, locally. Mirrors POST /api/seen with `remove: true` —
 * the roll-back a discarded lesson performs so its start no longer advances the
 * frontier. */
export function localDropSeen(facts: FactId[]): HistoryFile {
  return mutateHistory((h) => applyDropSeen(h, facts));
}

/** Retire a confusion record early, locally. Mirrors POST /api/mixup. */
export function localClearMixup(key: string, ts: number): HistoryFile {
  return mutateHistory((h) => applyClearMixup(h, key, ts));
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

// ---------- migration bookkeeping ----------

/** Is there anything worth replaying into a freshly signed-in account? Cheap
 * enough to ask on every authed mount (see migrate-local.ts) and the guard that
 * keeps the merge from running when a signed-out session touched nothing. */
export function hasLocalProgress(): boolean {
  const h = loadLocalHistory();
  return Boolean(
    h.sessions.length ||
      Object.keys(h.claims ?? {}).length ||
      Object.keys(h.seen ?? {}).length ||
      Object.keys(h.clearedMixups ?? {}).length,
  );
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

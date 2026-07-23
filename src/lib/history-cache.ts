"use client";

// The last history this browser saw, kept so a reload can paint before the
// server answers.
//
// A DISPLAY ACCELERATOR, NOTHING ELSE
// ===================================
// This cache is never a source of truth and never a source of writes. It exists
// for one moment: the instant after a reload when the screens would otherwise
// have nothing to show. The server's answer replaces whatever is here, whole —
// there is no merge, no field-level reconciliation, no "keep the newer
// timestamp". If the two disagree, the cache is simply wrong and is discarded.
// That rule is what makes the cache safe to be stale: nothing is ever computed
// from it that outlives the next server response, and no write is ever derived
// from it. (Signed-out progress is a different thing entirely and lives in
// store/local-progress.ts, which IS durable for that learner.)
//
// SCOPED TO ONE ACCOUNT
// =====================
// A browser can be shared. Every entry is keyed by user id AND carries that id
// inside the envelope, so a copy can only ever be handed back to the account it
// came from: a key from another account does not match, and a hand-edited or
// half-written envelope whose id disagrees with its key is thrown away. Writing
// also prunes every other account's entry, so the copy does not outlive the sign
// out that ended it.

import type { HistoryFile } from "@/types";

/** Namespace for the per-account entries. Distinct from `saku-local-*`, which is
 * the signed-out learner's durable progress and must never be confused with a
 * throwaway copy of an account's. */
export const HISTORY_CACHE_PREFIX = "saku-history-cache:";

/** What one entry looks like on disk. `savedAt` is diagnostic — nothing branches
 * on the age, because a cached copy is superseded by the next server answer
 * whatever its age. */
interface CacheEnvelope {
  userId: string;
  savedAt: number;
  history: HistoryFile;
}

export function historyCacheKey(userId: string): string {
  return `${HISTORY_CACHE_PREFIX}${userId}`;
}

/** localStorage, or null when there is none (SSR, or a browser that blocks it).
 * Same shape as local-progress.ts's: one place asks, every caller degrades the
 * same way. */
function storage(): Storage | null {
  try {
    if (typeof window === "undefined") return null;
    return window.localStorage;
  } catch {
    // Some privacy modes throw on the getter itself.
    return null;
  }
}

/** Coerce a parsed blob into the containers a HistoryFile promises, or null if
 * it is not one. Mirrors the normalizers in local-progress.ts and
 * supabase-store.ts: a copy written by an older build still reads as a usable
 * history, and anything else reads as nothing at all. */
function normalize(value: unknown): HistoryFile | null {
  if (!value || typeof value !== "object") return null;
  const h = value as Partial<HistoryFile>;
  if (!Array.isArray(h.sessions)) return null;
  if (h.facts && typeof h.facts !== "object") return null;
  return {
    sessions: h.sessions,
    facts: h.facts ?? {},
    claims: h.claims ?? {},
    seen: h.seen ?? {},
  };
}

/**
 * The cached history for `userId`, or null when there is nothing usable.
 *
 * Null covers every failure the same way — no entry, unreadable storage, bad
 * JSON, a shape that is not a history, an envelope stamped with a different
 * account. All of those mean "paint nothing yet and wait for the server", which
 * is exactly the behaviour this cache is an optimization over.
 */
export function readCachedHistory(userId: string): HistoryFile | null {
  const s = storage();
  if (!s || !userId) return null;
  try {
    const raw = s.getItem(historyCacheKey(userId));
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    const env = parsed as Partial<CacheEnvelope> | null;
    if (!env || typeof env !== "object") return null;
    // The id inside must agree with the id in the key. Belt and braces against
    // a copied profile or a key rewritten by hand: a mismatch is another
    // account's data, and showing it is the one failure this must not have.
    if (env.userId !== userId) return null;
    return normalize(env.history);
  } catch {
    return null;
  }
}

/**
 * Save `history` as this account's copy, and drop every other account's.
 *
 * Silent on failure: a full or blocked storage costs a slower first paint next
 * time and nothing else, and there is no learner action that would fix it.
 */
export function writeCachedHistory(userId: string, history: HistoryFile): void {
  const s = storage();
  if (!s || !userId) return;
  const key = historyCacheKey(userId);
  try {
    pruneOtherAccounts(s, key);
    const env: CacheEnvelope = { userId, savedAt: Date.now(), history };
    s.setItem(key, JSON.stringify(env));
  } catch {
    // out of quota, or storage disabled after the read
  }
}

/** Forget this account's copy — the sign-out half of the scoping rule. */
export function clearCachedHistory(userId: string): void {
  const s = storage();
  if (!s || !userId) return;
  try {
    s.removeItem(historyCacheKey(userId));
  } catch {
    // nothing to do
  }
}

/** Remove every namespaced entry except `keep`. Called on write so a shared
 * browser holds at most one account's copy at a time. */
function pruneOtherAccounts(s: Storage, keep: string): void {
  const stale: string[] = [];
  for (let i = 0; i < s.length; i++) {
    const k = s.key(i);
    if (k && k !== keep && k.startsWith(HISTORY_CACHE_PREFIX)) stale.push(k);
  }
  for (const k of stale) s.removeItem(k);
}

/** Where a history the UI is showing came from. `cache` is the only one that is
 * allowed to be wrong, and it is the only one a later `server` may replace. */
export type HistorySource = "empty" | "cache" | "local" | "server";

export interface HistoryState {
  history: HistoryFile;
  /** The consumers' gate: is there something real to render yet. A cached copy
   * counts, which is the whole point of having one. */
  loaded: boolean;
  source: HistorySource;
}

export const EMPTY_HISTORY: HistoryFile = { sessions: [], facts: {} };

export const INITIAL_HISTORY_STATE: HistoryState = {
  history: EMPTY_HISTORY,
  loaded: false,
  source: "empty",
};

/** What a revalidation produced. `unavailable` is the server failing or being
 * unreachable, which is not an answer and so changes nothing. */
export type RevalidationOutcome =
  | { kind: "server"; history: HistoryFile }
  | { kind: "local"; history: HistoryFile }
  | { kind: "unavailable" };

/**
 * The reconciliation rule, as one function so it can be read and tested in one
 * place.
 *
 *   server       → wins outright, whatever was showing. Replaces, never merges.
 *   local        → the signed-out learner's own store answering a 401. Also
 *                  authoritative for them, for the same reason: it is where
 *                  their writes went.
 *   unavailable  → keep what is on screen. A cached copy that is possibly stale
 *                  beats blanking a working screen, and it stays marked `cache`
 *                  so the next successful answer still overwrites it.
 */
export function applyRevalidation(
  prev: HistoryState,
  outcome: RevalidationOutcome,
): HistoryState {
  if (outcome.kind === "unavailable") {
    // Nothing new to show, but the wait is over either way.
    return prev.loaded ? prev : { ...prev, loaded: true };
  }
  return { history: outcome.history, loaded: true, source: outcome.kind };
}

/** The mount state, given whatever the server put in the page. A seed is the
 * server's own answer for this very request, so it lands as one: `loaded` is
 * true before a single line of client code runs, which is the whole point of
 * seeding. */
export function seededState(initial: HistoryFile | null): HistoryState {
  if (!initial) return INITIAL_HISTORY_STATE;
  return { history: initial, loaded: true, source: "server" };
}

/**
 * What one GET /api/history means, as data.
 *
 * Split out from the fetch so the three-way answer can be read in one place and
 * tested without a network: `readLocal` is passed in for the same reason — the
 * signed-out branch is the interesting one, and it must keep working.
 */
export async function outcomeForResponse(
  res: { ok: boolean; status: number; json: () => Promise<unknown> },
  readLocal: () => HistoryFile,
): Promise<RevalidationOutcome> {
  if (res.ok) return { kind: "server", history: (await res.json()) as HistoryFile };
  // 401 = signed out (Supabase mode). The account has no history yet, but this
  // browser might: signed-out writes fall back to localStorage (see
  // progress-fetch.ts / local-progress.ts), and this is where they are read back
  // so the screens show them. Without this, every signed-out write would look
  // lost the instant the UI refetched.
  if (res.status === 401) return { kind: "local", history: readLocal() };
  // 503 — the history exists and could not be read. Saying "nothing yet" over it
  // would be the app telling a learner their work is gone.
  return { kind: "unavailable" };
}

/**
 * Adopt a cached copy, if it is still worth adopting.
 *
 * Only ever fills an empty screen: once anything real has landed the cache has
 * missed its moment, and letting it in then would be the cache clobbering the
 * server, which is the one thing it must never do. Written as a guard rather
 * than left to call-site ordering because the cache read is async in practice
 * (an effect) and can land after a fast server answer.
 */
export function applyCached(
  prev: HistoryState,
  cached: HistoryFile | null,
): HistoryState {
  if (!cached || prev.source !== "empty") return prev;
  return { history: cached, loaded: true, source: "cache" };
}

// SAFE READ-MODIFY-WRITE FOR THE ONE SHARED history ROW.
//
// THE BUG THIS CLOSES
// ===================
// Every server-side history write was load → apply a pure op → write the WHOLE
// blob back (history.ts, and store/supabase-store.ts's whole-column upsert). Two
// requests that overlap — and the app manufactures exactly this, because
// claiming a curriculum lesson fires POST /api/claim AND POST /api/seen at the
// same instant (home-feed.tsx) — both LOAD the same base, each applies its own
// field, and each writes the whole blob. Last writer wins, and the field the
// loser added is silently gone: a claim dropped while the seen it raced survives,
// or the reverse. Repeated across many clicks this punches GAPS into the claimed
// curriculum sequence, and the frontier — which stops at the first not-yet-known
// item — walks back toward lesson one while grammar and counters (which need only
// SOME items known, not a contiguous run) stay put. It is a partial, durable data
// loss, not a display glitch: it survives a reload because the row itself is
// missing the record.
//
// THE RULE
// ========
// Optimistic concurrency. A read carries the row's version token; the write only
// lands if the row STILL carries that token, so a concurrent write that moved it
// first makes ours miss. On a miss we re-read the winner's state and re-apply our
// op onto it, up to a small bound. Two overlapping writes therefore SERIALIZE:
// whichever commits second rebuilds on the first, and both fields survive. This
// is deployment-independent (it holds across separate serverless invocations and
// devices, where an in-process lock would not) and needs no schema change — the
// `updated_at` the row already carries is the token.
//
// This module is the pure control flow, with the store handed in, so the retry
// logic is testable without a database. store/supabase-store.ts supplies the real
// read/CAS-write; history.ts wires the two together for every mutator.

import type { HistoryFile } from "@/types";

/** A versioned read of the row: the history, the concurrency token to write
 * against, and whether a row exists at all. */
export interface VersionedRead {
  history: HistoryFile;
  /** The row's optimistic-concurrency token (its `updated_at`), or null when the
   * row carries none yet — no row, or a legacy row written before the column. */
  version: string | null;
  /** Whether a row exists. Separates "insert the first row" from "update, guarding
   * on a null token", which read as the same `version: null` otherwise. */
  exists: boolean;
}

export interface HistoryStore {
  /** The current row, with its concurrency token. */
  read(userId: string): Promise<VersionedRead>;
  /**
   * Persist `next` ONLY if the row still matches `expected` (compare-and-set).
   * Returns true when it landed, false when a concurrent writer moved the token
   * first — the signal to re-read and re-apply. Any other failure throws.
   */
  write(userId: string, next: HistoryFile, expected: VersionedRead): Promise<boolean>;
}

/** How many times a write may lose the CAS before we give up. A miss means an
 * overlapping writer beat us; each retry rebuilds on their result, so more than a
 * couple of rounds means sustained contention on ONE user's row, which does not
 * happen in normal use. Bounded so a pathological loop throws instead of spinning. */
export const MAX_HISTORY_WRITE_ATTEMPTS = 5;

/**
 * Apply `op` to the user's history and persist it, safe against a concurrent
 * writer clobbering it.
 *
 * The NO-OP CONTRACT is honoured and cheap: applySession / applyDeleteSessions
 * return the SAME reference when nothing changed (a duplicate session id, a
 * delete that selected nothing), and this writes nothing and contends for no row
 * in that case — exactly what history.ts did with `if (next !== hist)`.
 */
export async function mutateHistoryWithRetry(
  store: HistoryStore,
  userId: string,
  op: (hist: HistoryFile) => HistoryFile,
  maxAttempts: number = MAX_HISTORY_WRITE_ATTEMPTS,
): Promise<HistoryFile> {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const current = await store.read(userId);
    const next = op(current.history);
    // Nothing changed: no write, no contention. Preserves the exact "bail before
    // touching the row" behaviour the dedup and empty-delete paths rely on.
    if (next === current.history) return next;
    if (await store.write(userId, next, current)) return next;
    // Lost the CAS to an overlapping write. Loop: re-read the winner's state and
    // re-apply our op onto it, so our field is added to theirs instead of over it.
  }
  throw new Error(
    `history write for user ${userId} lost to concurrent writers ${maxAttempts} times`,
  );
}

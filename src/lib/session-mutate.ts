// SAFE READ-RECONCILE-WRITE FOR THE `session` HALF OF THE SHARED progress ROW.
//
// THE BUG THIS CLOSES (SAK-260)
// ==============================
// session-store.ts's saveSessionState already picks the fresher of two
// envelopes by `updatedAt` (pickNewer, in session-state.ts) — but pre-fix, that
// pick ran over a plain read-then-write with no concurrency guard at all:
//
//     const winner = pickNewer(await loadSessionState(userId), incoming);
//     await writeSessionState(userId, winner);
//
// Two devices posting near-simultaneously each do their OWN read, each compute
// their OWN "winner" against what they read, and each blindly overwrite the row
// with their own answer. Neither write is atomic with its read, so ordinary
// timing defeats the guard: device A reads the row, decides its update is
// newer, and is about to write; device B does the same in parallel. Whichever
// write lands SECOND wins outright — not because it actually carried the newer
// `updatedAt`, but because it was a blind overwrite that never checked whether
// the row had changed since ITS read. The reconcile-newer-version logic never
// even ran against the actual final state of the row; it ran against a stale
// snapshot each device took independently. One device's in-progress round is
// silently gone.
//
// THE RULE
// ========
// Identical to history's, lists', and settings' (SAK-258): a read carries the
// row's version token, the write only lands if the row STILL carries it, and a
// miss re-reads the winner and re-runs pickNewer against THEIR envelope (which
// itself might now be newer than what we originally read, or might still be
// older than our incoming write — either way we recompute the real answer
// instead of trusting a stale one). `updated_at` is the token — the same column
// history/lists/settings guard on, which is right because it is the same row: a
// history, lists, or settings write landing mid-flight simply costs a session
// retry, never a lost round.
//
// WHY RE-APPLY WORKS FOR SESSION. The "op" here is pickNewer(current, incoming) —
// pure and idempotent over whatever the winner turns out to hold, so re-running
// it against a concurrent writer's fresher envelope produces the same correct
// last-writer-wins answer pickNewer always promised, this time actually checked
// against the row that is really there.
//
// This module is the pure control flow with the store handed in, so the retry
// logic is testable without a database — store/supabase-store.ts supplies the
// real read/CAS-write and session-store.ts wires them together.

import type { SessionStateEnvelope } from "@/lib/session-state";

/** A versioned read of the session half of the row: the envelope, the
 * concurrency token to write against, and whether a row exists at all. The
 * twin of settings-mutate.ts's SettingsVersionedRead, over the `session`
 * column. */
export interface SessionVersionedRead {
  envelope: SessionStateEnvelope;
  /** The row's optimistic-concurrency token (its `updated_at`), or null when the
   * row carries none yet — no row, or a legacy row written before the column. */
  version: string | null;
  /** Whether a row exists. Separates "insert the first row" from "update,
   * guarding on a null token", which read as the same `version: null` otherwise. */
  exists: boolean;
}

export interface SessionStore {
  /** The current session envelope, with the row's concurrency token. */
  read(userId: string): Promise<SessionVersionedRead>;
  /**
   * Persist `next` ONLY if the row still matches `expected` (compare-and-set).
   * Returns true when it landed, false when a concurrent writer moved the token
   * first — the signal to re-read and re-reconcile. Any other failure throws.
   */
  write(
    userId: string,
    next: SessionStateEnvelope,
    expected: SessionVersionedRead,
  ): Promise<boolean>;
}

/** How many times a session write may lose the CAS before we give up. Same
 * bound and reasoning as history/lists/settings: each retry rebuilds on the
 * winner, so more than a couple of rounds means sustained contention on ONE
 * user's row. Bounded so a pathological loop throws (-> 500 -> the client's
 * reliable-write path retries) instead of spinning or silently overwriting. */
export const MAX_SESSION_WRITE_ATTEMPTS = 5;

/**
 * Apply `op` (last-writer-wins reconcile against the incoming envelope) and
 * persist the result, safe against a concurrent writer clobbering it.
 *
 * The NO-OP CONTRACT, exactly lists': when `op` decides the row already holds
 * the winner (our incoming write lost to what is already stored), it returns
 * the SAME reference and this writes nothing — no pointless churn of the row's
 * CAS token, and no contention imposed on any other writer for a post that
 * changes nothing.
 *
 * Throwing on exhaustion is the load-bearing half of the fix, exactly as for
 * history/lists/settings: a write that cannot be proven to land must not
 * answer 2xx to a caller whose device would otherwise believe its round
 * synced when it did not.
 */
export async function mutateSessionStateWithRetry(
  store: SessionStore,
  userId: string,
  op: (envelope: SessionStateEnvelope) => SessionStateEnvelope,
  maxAttempts: number = MAX_SESSION_WRITE_ATTEMPTS,
): Promise<SessionStateEnvelope> {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const current = await store.read(userId);
    const next = op(current.envelope);
    if (next === current.envelope) return next;
    if (await store.write(userId, next, current)) return next;
    // Lost the CAS to an overlapping write. Loop: re-read the winner's envelope
    // and re-run the reconcile against it, so the real last-writer-wins answer
    // is computed against what is actually stored, not a stale snapshot.
  }
  throw new Error(
    `session write for user ${userId} lost to concurrent writers ${maxAttempts} times`,
  );
}

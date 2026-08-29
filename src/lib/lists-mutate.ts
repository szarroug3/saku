// SAFE READ-MODIFY-WRITE FOR THE `lists` HALF OF THE SHARED progress ROW.
//
// THE BUG THIS CLOSES
// ===================
// history got optimistic concurrency (history-mutate.ts); lists never did. Every
// server-side list write was load → apply → upsert the WHOLE blob back, so two
// overlapping writes clobbered each other and the loser's lists were gone. The
// worst case is not a dropped edit but a WIPE: two devices signing into the same
// account within the same second each replay their own signed-out lists
// (store/migrate-local.ts). Both read the same empty/stale row, each writes only
// its own lists, the later write wins — and because BOTH requests answered 2xx,
// both devices then cleared their local copy. The losing device's lists were
// gone from local storage AND the server, unrecoverably.
//
// THE RULE
// ========
// Identical to history's, and deliberately so: a read carries the row's version
// token, the write only lands if the row STILL carries it, and a miss re-reads
// the winner and re-applies our op onto THEIR state. Two overlapping writes
// serialize instead of racing, so device B's lists are added to device A's
// rather than written over them. `updated_at` is the token — the same column
// history guards on, which is right because it is the same row: a history write
// landing mid-flight simply costs a lists retry, never a lost list.
//
// WHY RE-APPLY WORKS FOR LISTS. Every list op is keyed by list id (save/replace,
// add/remove entries, rename, delete), so re-running it against the winner's
// file touches only OUR list and leaves theirs intact. There is no whole-file
// "replace the lists with exactly these" op, which is the only shape this could
// not reconcile.
//
// This module is the pure control flow with the store handed in, so the retry
// logic is testable without a database — store/supabase-store.ts supplies the
// real read/CAS-write and lists.ts wires them together for every mutator.

import type { ListsFile } from "@/types";

/** A versioned read of the lists half of the row: the file, the concurrency
 * token to write against, and whether a row exists at all. The twin of
 * history-mutate.ts's VersionedRead, over the other column. */
export interface ListsVersionedRead {
  lists: ListsFile;
  /** The row's optimistic-concurrency token (its `updated_at`), or null when the
   * row carries none yet — no row, or a legacy row written before the column. */
  version: string | null;
  /** Whether a row exists. Separates "insert the first row" from "update,
   * guarding on a null token", which read as the same `version: null` otherwise. */
  exists: boolean;
}

export interface ListsStore {
  /** The current lists, with the row's concurrency token. */
  read(userId: string): Promise<ListsVersionedRead>;
  /**
   * Persist `next` ONLY if the row still matches `expected` (compare-and-set).
   * Returns true when it landed, false when a concurrent writer moved the token
   * first — the signal to re-read and re-apply. Any other failure throws.
   */
  write(
    userId: string,
    next: ListsFile,
    expected: ListsVersionedRead,
  ): Promise<boolean>;
}

/** How many times a list write may lose the CAS before we give up. Same bound
 * and same reasoning as history: each retry rebuilds on the winner, so more than
 * a couple of rounds means sustained contention on ONE user's row. Bounded so a
 * pathological loop throws (→ 500 → the caller keeps its local copy) instead of
 * spinning or, worse, silently overwriting. */
export const MAX_LISTS_WRITE_ATTEMPTS = 5;

/**
 * Apply `op` to the user's lists and persist them, safe against a concurrent
 * writer clobbering them.
 *
 * The NO-OP CONTRACT: an op that changed nothing (an add to a list that is not
 * there, a delete of an id that is already gone, a rename to the same name)
 * returns the SAME reference, and this then writes nothing and contends for no
 * row — the row is not churned and no other writer is made to retry for an edit
 * that had no effect.
 *
 * Throwing on exhaustion is the load-bearing half of the fix. The caller that
 * matters most is the sign-in replay, which clears the local copy on a 2xx: a
 * write that could not be proven to land MUST NOT answer 2xx.
 */
export async function mutateListsWithRetry(
  store: ListsStore,
  userId: string,
  op: (file: ListsFile) => ListsFile,
  maxAttempts: number = MAX_LISTS_WRITE_ATTEMPTS,
): Promise<ListsFile> {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const current = await store.read(userId);
    const next = op(current.lists);
    if (next === current.lists) return next;
    if (await store.write(userId, next, current)) return next;
    // Lost the CAS to an overlapping write. Loop: re-read the winner's lists and
    // re-apply our op onto them, so our list joins theirs instead of replacing it.
  }
  throw new Error(
    `lists write for user ${userId} lost to concurrent writers ${maxAttempts} times`,
  );
}

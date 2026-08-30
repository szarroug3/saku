// SAFE READ-MODIFY-WRITE FOR THE `settings` HALF OF THE SHARED progress ROW.
//
// THE BUG THIS CLOSES
// ===================
// history and lists both got optimistic concurrency (history-mutate.ts,
// lists-mutate.ts); settings never did. Every server-side settings write was
// load -> mergeSettings(loaded, patch) -> upsert the WHOLE blob back
// (settings.ts's old saveSettings + supabase-store.ts's writeSettingsRow), so
// two overlapping writes clobbered each other. Change one setting on device A
// and a DIFFERENT setting on device B inside the same window and one of them
// is silently gone: both requests read the same row, each writes back its own
// full merged copy, and the later write wins outright — the earlier device's
// field is simply not in that blob. Unlike the lists bug this is not usually a
// total wipe (mergeSettings only replaces the fields a patch actually names),
// but it is the same missing guard, and neither device is ever told anything
// was lost.
//
// THE RULE
// ========
// Identical to history's and lists', and deliberately so: a read carries the
// row's version token, the write only lands if the row STILL carries it, and a
// miss re-reads the winner and re-applies our patch onto THEIR settings.
// `updated_at` is the token — the same column history and lists guard on,
// which is right because it is the same row: a history or lists write landing
// mid-flight simply costs a settings retry, never a lost field.
//
// WHY RE-APPLY WORKS FOR SETTINGS. mergeSettings is a field-level replace: a
// patch names only the fields it changed, and re-running "merge THIS patch"
// against the winner's settings touches only those fields and leaves every
// other field (including whatever the winner itself just changed) intact. There
// is no whole-file "replace the settings with exactly these" op here — every
// caller goes through a patch — so there is nothing this could fail to
// reconcile the way lists' since-removed whole-file replace would have.
//
// This module is the pure control flow with the store handed in, so the retry
// logic is testable without a database — store/supabase-store.ts supplies the
// real read/CAS-write and settings.ts wires them together.

import type { SettingsFile } from "@/types";

/** A versioned read of the settings half of the row: the file, the concurrency
 * token to write against, and whether a row exists at all. The twin of
 * lists-mutate.ts's ListsVersionedRead, over the `settings` column. */
export interface SettingsVersionedRead {
  settings: SettingsFile;
  /** The row's optimistic-concurrency token (its `updated_at`), or null when the
   * row carries none yet — no row, or a legacy row written before the column. */
  version: string | null;
  /** Whether a row exists. Separates "insert the first row" from "update,
   * guarding on a null token", which read as the same `version: null` otherwise. */
  exists: boolean;
}

export interface SettingsStore {
  /** The current settings, with the row's concurrency token. */
  read(userId: string): Promise<SettingsVersionedRead>;
  /**
   * Persist `next` ONLY if the row still matches `expected` (compare-and-set).
   * Returns true when it landed, false when a concurrent writer moved the token
   * first — the signal to re-read and re-apply. Any other failure throws.
   */
  write(
    userId: string,
    next: SettingsFile,
    expected: SettingsVersionedRead,
  ): Promise<boolean>;
}

/** How many times a settings write may lose the CAS before we give up. Same
 * bound and reasoning as history/lists: each retry rebuilds on the winner, so
 * more than a couple of rounds means sustained contention on ONE user's row.
 * Bounded so a pathological loop throws (-> 500 -> the caller sees a failed
 * save and can retry) instead of spinning or silently overwriting. */
export const MAX_SETTINGS_WRITE_ATTEMPTS = 5;

/**
 * Apply a settings patch (via `op`) and persist it, safe against a concurrent
 * writer clobbering it.
 *
 * Throwing on exhaustion is the load-bearing half of the fix, exactly as for
 * history/lists: a write that cannot be proven to land must not answer 2xx to
 * a caller whose banner would otherwise report a save that never happened.
 */
export async function mutateSettingsWithRetry(
  store: SettingsStore,
  userId: string,
  op: (file: SettingsFile) => SettingsFile,
  maxAttempts: number = MAX_SETTINGS_WRITE_ATTEMPTS,
): Promise<SettingsFile> {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const current = await store.read(userId);
    const next = op(current.settings);
    if (await store.write(userId, next, current)) return next;
    // Lost the CAS to an overlapping write. Loop: re-read the winner's settings
    // and re-apply our patch onto them, so our field joins theirs instead of
    // replacing it.
  }
  throw new Error(
    `settings write for user ${userId} lost to concurrent writers ${maxAttempts} times`,
  );
}

// Server-side persistence for a signed-in learner's settings — the `settings`
// jsonb on their `progress` row, beside history.
//
// WHO REACHES THIS. Only a signed-in request (getUserId → 401 otherwise). A
// signed-out visitor's preferences live in this browser's localStorage cache
// (see the client settings store), never here.
//
// A SEPARATE BLOB FROM history, on the same row. Settings are not something you
// DID; they outlive a "delete all my history" and must never be collateral in
// one. Writing settings leaves history untouched (the upsert only sets the
// `settings` column), and vice versa.
//
// THE SERVER IS THE SOURCE OF TRUTH for a signed-in learner. The client mirrors
// these values into localStorage as a paint cache, but the durable copy is the
// row. A write MERGES a partial patch into the stored blob (mergeSettings) so a
// single-field change never clobbers the rest.
//
// EVERY MUTATOR GOES THROUGH COMPARE-AND-SET (SAK-258). This used to be load ->
// mergeSettings(loaded, patch) -> upsert the whole blob, which let two
// overlapping writes clobber each other: change one setting on device A and a
// different one on device B in the same window, and whichever write landed
// second silently dropped the other's field — see settings-mutate.ts. The write
// is now a PURE patch re-applied against whatever a concurrent writer left
// behind, so a lost race merges instead of overwriting.

import { timed } from "@/lib/server-timing";
import "server-only";

import { mergeSettings } from "@/lib/settings-merge";
import { mutateSettingsWithRetry, type SettingsStore } from "@/lib/settings-mutate";
import {
  readSettingsRow,
  readSettingsRowVersioned,
  writeSettingsRowGuarded,
} from "@/lib/store/supabase-store";
import type { SettingsFile } from "@/types";

/** The compare-and-set store saveSettings runs its read-modify-write through,
 * so two overlapping requests cannot clobber each other's fields. One
 * instance, since it is stateless — the request-bound Supabase client is
 * created per call inside these primitives. The twin of lists.ts's `store`. */
const store: SettingsStore = {
  read: readSettingsRowVersioned,
  write: writeSettingsRowGuarded,
};

/** The signed-in learner's settings. readSettingsRow normalizes an unset column
 * into the empty (all-default) settings. */
export async function loadSettings(userId: string): Promise<SettingsFile> {
  return timed("settings", () => readSettingsRow(userId), "reading the learner's settings");
}

/**
 * Merge a partial settings patch into the stored blob and persist it, safe
 * against a concurrent writer. So a POST that saves one practice recipe leaves
 * cfg and the misses exactly as they were. AND, if another device's write to a
 * different field lands in between, that field survives too instead of being
 * overwritten by this write's stale copy of it.
 */
export async function saveSettings(
  userId: string,
  patch: SettingsFile,
): Promise<SettingsFile> {
  return mutateSettingsWithRetry(store, userId, (settings) =>
    mergeSettings(settings, patch),
  );
}

// Server-side persistence for a signed-in learner's settings — the `settings`
// jsonb on their `progress` row, beside history, lists and session.
//
// WHO REACHES THIS. Only a signed-in request (getUserId → 401 otherwise). A
// signed-out visitor's preferences live in this browser's localStorage cache
// (theme especially — see the client settings store), never here.
//
// A SEPARATE BLOB FROM history AND lists, on the same row. Settings are not
// something you DID and not a saved list; they outlive a "delete all my history"
// and must never be collateral in one. Writing settings leaves history and lists
// untouched (the upsert only sets the `settings` column), and vice versa.
//
// THE SERVER IS THE SOURCE OF TRUTH for a signed-in learner. The client mirrors
// these values into localStorage as a paint cache (theme especially — the
// no-flash script cannot read the server), but the durable copy is the row. A
// write MERGES a partial patch into the stored blob (mergeSettings) so a
// single-field change never clobbers the rest.

import "server-only";

import { mergeSettings } from "@/lib/settings-merge";
import { readSettingsRow, writeSettingsRow } from "@/lib/store/supabase-store";
import type { SettingsFile } from "@/types";

/** The signed-in learner's settings. readSettingsRow normalizes an unset column
 * into the empty (all-default) settings. */
export async function loadSettings(userId: string): Promise<SettingsFile> {
  return readSettingsRow(userId);
}

/** The write half — upserts only the `settings` column. */
async function writeSettings(userId: string, settings: SettingsFile): Promise<void> {
  await writeSettingsRow(userId, settings);
}

/**
 * Merge a partial settings patch into the stored blob and persist it.
 *
 * Read-modify-write on the whole blob, exactly like saveList: load the current
 * settings, field-replace with whatever the patch carries (mergeSettings), write
 * the result back. So a POST that changes only the theme leaves cfg, the accent
 * map, the dismissal flags and the latency window exactly as they were.
 */
export async function saveSettings(
  userId: string,
  patch: SettingsFile,
): Promise<SettingsFile> {
  const next = mergeSettings(await loadSettings(userId), patch);
  await writeSettings(userId, next);
  return next;
}

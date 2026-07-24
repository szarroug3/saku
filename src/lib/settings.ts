// Server-side persistence for the learner's settings — the third blob beside
// history and lists.
//
// WHERE A SETTINGS BLOB LIVES depends on STORAGE_BACKEND (see store/mode.ts): the
// local settings.json at the repo root in file mode, or the per-user `settings`
// jsonb on the `progress` row in Supabase in hosted mode. Same split as lists.ts
// — the read-modify-write LOGIC (the MERGE) lives in settings-merge.ts, and the
// one-line backend branch in loadSettings / writeSettings is all that changes
// between the two stores.
//
// A SEPARATE BLOB FROM history AND lists, on the same row/dir. Settings are not
// something you DID and not a saved list; they outlive a "delete all my history"
// and must never be collateral in one. Writing settings leaves history and lists
// untouched (the upsert only sets the `settings` column), and vice versa.
//
// THE SERVER IS THE SOURCE OF TRUTH. The client mirrors these values into
// localStorage as a paint cache (theme especially — the no-flash script cannot
// read the server), but the durable copy is here. A write MERGES a partial patch
// into the stored blob (mergeSettings) so a single-field change never clobbers
// the rest.

import "server-only";

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import path from "node:path";

import { mergeSettings, normalizeSettings } from "@/lib/settings-merge";
import { isSupabaseStore } from "@/lib/store/mode";
import { readSettingsRow, writeSettingsRow } from "@/lib/store/supabase-store";
import type { SettingsFile } from "@/types";

// WHERE the local file lives — the repo root by default, the same SAKU_DATA_DIR
// override history.ts / lists.ts document (the e2e suite points it at a throwaway
// directory; unset in every normal run).
const DATA_DIR = process.env.SAKU_DATA_DIR
  ? path.resolve(process.env.SAKU_DATA_DIR)
  : process.cwd();
const SETTINGS_PATH = path.join(DATA_DIR, "settings.json");

/** Indent 1, no trailing newline — legible under `git diff`, same rule as
 * history.ts / lists.ts. */
function writeSettingsFile(settings: SettingsFile): void {
  writeFileSync(SETTINGS_PATH, JSON.stringify(settings, null, 1), "utf-8");
}

/** Read settings.json. A missing or corrupt file reads as the empty (all-default)
 * settings — the disposable-read rule lists.ts uses, and correct here because an
 * absent settings file genuinely means "no preferences saved yet", which is a
 * valid state, not damage. (Unlike history.json, nothing irreplaceable lives
 * here: every value self-heals or is a re-pickable preference.) */
function readSettingsFile(): SettingsFile {
  if (existsSync(SETTINGS_PATH)) {
    try {
      return normalizeSettings(JSON.parse(readFileSync(SETTINGS_PATH, "utf-8")));
    } catch {
      // missing/corrupt file yields empty settings, same as lists
    }
  }
  return {};
}

/** The current backend's settings for `userId`. File mode ignores the id (one
 * settings.json); Supabase reads the user's own row under RLS. */
export async function loadSettings(userId: string): Promise<SettingsFile> {
  return isSupabaseStore() ? readSettingsRow(userId) : readSettingsFile();
}

/** The write half — the same backend split. */
async function writeSettings(userId: string, settings: SettingsFile): Promise<void> {
  if (isSupabaseStore()) await writeSettingsRow(userId, settings);
  else writeSettingsFile(settings);
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

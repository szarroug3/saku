import "server-only";

// The Supabase backend for a user's progress. Reads and writes the two JSON
// blobs — history and lists — as jsonb columns on that user's single `progress`
// row. Every call runs through the request-bound server client, so RLS confines
// it to the caller's own row; `userId` is passed for the explicit `.eq` and the
// upsert key, never to reach across users (RLS would refuse that anyway).
//
// These are the primitives history.ts / lists.ts call in Supabase mode, in place
// of the local file read/write. The read-modify-write LOGIC stays in those
// files; this only moves where the blob lives. Unset columns are left untouched
// on upsert, so writing history never disturbs lists and vice versa.

import {
  normalizeEnvelope,
  type SessionStateEnvelope,
} from "@/lib/session-state";
import { hydrateRecentRuns } from "@/lib/aggregate";
import { normalizeSettings } from "@/lib/settings-merge";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { HistoryFile, ListsFile, SettingsFile } from "@/types";

function normalizeHistory(raw: unknown): HistoryFile {
  const h = (raw ?? {}) as Partial<HistoryFile>;
  const sessions = Array.isArray(h.sessions) ? h.sessions : [];
  return {
    sessions,
    facts: hydrateRecentRuns(h.facts ?? {}, sessions),
    claims: h.claims ?? {},
    seen: h.seen ?? {},
    ...(h.clearedMixups ? { clearedMixups: h.clearedMixups } : {}),
  };
}

export async function readHistoryRow(userId: string): Promise<HistoryFile> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("progress")
    .select("history")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Error(`reading progress.history failed: ${error.message}`);
  return normalizeHistory(data?.history);
}

export async function writeHistoryRow(userId: string, hist: HistoryFile): Promise<void> {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("progress")
    .upsert(
      { user_id: userId, history: hist, updated_at: new Date().toISOString() },
      { onConflict: "user_id" },
    );
  if (error) throw new Error(`writing progress.history failed: ${error.message}`);
}

export async function readListsRow(userId: string): Promise<ListsFile> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("progress")
    .select("lists")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Error(`reading progress.lists failed: ${error.message}`);
  const raw = (data?.lists ?? {}) as Partial<ListsFile> | null;
  return { lists: raw?.lists ?? [] };
}

export async function writeListsRow(userId: string, file: ListsFile): Promise<void> {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("progress")
    .upsert(
      { user_id: userId, lists: file, updated_at: new Date().toISOString() },
      { onConflict: "user_id" },
    );
  if (error) throw new Error(`writing progress.lists failed: ${error.message}`);
}

// The `settings` jsonb is the third blob on the row, beside `history` and
// `lists`. It is added by scripts/sql/add-settings-column.sql and inherits the
// row's existing RLS (which scopes every read/write to `user_id`), so no new
// policy is needed. Same read-modify-write split as history/lists: the MERGE
// logic lives in settings.ts, this only moves the blob to and from the row, and
// an unset `settings` column reads as the empty (all-default) settings.

export async function readSettingsRow(userId: string): Promise<SettingsFile> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("progress")
    .select("settings")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Error(`reading progress.settings failed: ${error.message}`);
  return normalizeSettings(data?.settings);
}

export async function writeSettingsRow(
  userId: string,
  settings: SettingsFile,
): Promise<void> {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("progress")
    .upsert(
      { user_id: userId, settings, updated_at: new Date().toISOString() },
      { onConflict: "user_id" },
    );
  if (error) throw new Error(`writing progress.settings failed: ${error.message}`);
}

// The `session` jsonb is the fourth blob on the row, beside `history`, `lists`
// and `settings`. It holds the IN-PROGRESS run envelope (see session-state.ts) —
// separate from `history`, which holds what you FINISHED. Added by
// scripts/sql/add-session-column.sql and inherits the row's RLS. An unset column
// reads as the empty envelope (no synced run). Same read/write-a-whole-blob split
// as the others; the last-writer-wins reconcile is applied in session-store.ts.

export async function readSessionRow(userId: string): Promise<SessionStateEnvelope> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("progress")
    .select("session")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Error(`reading progress.session failed: ${error.message}`);
  return normalizeEnvelope(data?.session);
}

export async function writeSessionRow(
  userId: string,
  session: SessionStateEnvelope,
): Promise<void> {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("progress")
    .upsert(
      { user_id: userId, session, updated_at: new Date().toISOString() },
      { onConflict: "user_id" },
    );
  if (error) throw new Error(`writing progress.session failed: ${error.message}`);
}

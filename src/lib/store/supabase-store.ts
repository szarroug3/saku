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
import type { VersionedRead } from "@/lib/history-mutate";
import { normalizeSettings } from "@/lib/settings-merge";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { HistoryFile, ListsFile, SettingsFile } from "@/types";

export interface ProgressSeedRow {
  history: HistoryFile;
  settings: SettingsFile;
  session: SessionStateEnvelope;
  lists: ListsFile;
}

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

export async function readProgressSeedRow(
  userId: string,
): Promise<ProgressSeedRow> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("progress")
    .select("history, settings, session, lists")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Error(`reading progress seed failed: ${error.message}`);
  const rawLists = (data?.lists ?? {}) as Partial<ListsFile> | null;
  return {
    history: normalizeHistory(data?.history),
    settings: normalizeSettings(data?.settings),
    session: normalizeEnvelope(data?.session),
    lists: { lists: rawLists?.lists ?? [] },
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

/**
 * A versioned read of the history row, for the compare-and-set write below. The
 * `updated_at` is the concurrency token: a write only lands if the row still
 * carries the value seen here (see history-mutate.ts). `maybeSingle` returns null
 * for a user with no row yet, which reads as an empty history and `exists: false`.
 */
export async function readHistoryRowVersioned(userId: string): Promise<VersionedRead> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("progress")
    .select("history, updated_at")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Error(`reading progress.history failed: ${error.message}`);
  return {
    history: normalizeHistory(data?.history),
    version: (data?.updated_at as string | null | undefined) ?? null,
    exists: data != null,
  };
}

/** Postgres unique-violation (a row inserted concurrently under the same
 * user_id). Not an error to surface — it is the "someone beat me to the first
 * write" signal, handled as a CAS miss. */
function isUniqueViolation(error: { code?: string }): boolean {
  return error.code === "23505";
}

/**
 * Write the history ONLY if the row still carries `expected` — optimistic
 * concurrency, so two overlapping writes cannot clobber each other. Returns true
 * when it landed, false when a concurrent writer moved the token first.
 *
 * The new `updated_at` is forced strictly greater than the one we guarded on, so
 * even two writes landing in the same millisecond leave DISTINCT tokens: after
 * the first commits, the second's guard cannot still match the value it read, so
 * the second is reliably detected as a miss and retried (Postgres re-checks the
 * WHERE against the freshly committed row under READ COMMITTED). No integer
 * version column, and so no schema migration, is needed.
 */
export async function writeHistoryRowGuarded(
  userId: string,
  hist: HistoryFile,
  expected: VersionedRead,
): Promise<boolean> {
  const supabase = await createSupabaseServerClient();
  const prev = expected.version ? Date.parse(expected.version) : 0;
  const nextTs = new Date(Math.max(Date.now(), prev + 1)).toISOString();

  // No row yet: INSERT. A row that appeared since our read violates the user_id
  // uniqueness, which is precisely the CAS miss we retry on.
  if (!expected.exists) {
    const { error } = await supabase
      .from("progress")
      .insert({ user_id: userId, history: hist, updated_at: nextTs });
    if (error) {
      if (isUniqueViolation(error)) return false;
      throw new Error(`writing progress.history failed: ${error.message}`);
    }
    return true;
  }

  // Row exists: UPDATE guarded on the token. `.select` reports the affected rows,
  // so zero rows means the guard did not match — a concurrent writer got there
  // first. A legacy row with a null token is guarded with `.is`, not `.eq`.
  const base = supabase
    .from("progress")
    .update({ history: hist, updated_at: nextTs })
    .eq("user_id", userId);
  const guarded =
    expected.version == null
      ? base.is("updated_at", null)
      : base.eq("updated_at", expected.version);
  const { data, error } = await guarded.select("user_id");
  if (error) throw new Error(`writing progress.history failed: ${error.message}`);
  return (data?.length ?? 0) > 0;
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

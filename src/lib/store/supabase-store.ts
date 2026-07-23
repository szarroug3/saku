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

import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { HistoryFile, ListsFile } from "@/types";

function normalizeHistory(raw: unknown): HistoryFile {
  const h = (raw ?? {}) as Partial<HistoryFile>;
  return {
    sessions: Array.isArray(h.sessions) ? h.sessions : [],
    facts: h.facts ?? {},
    claims: h.claims ?? {},
    seen: h.seen ?? {},
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

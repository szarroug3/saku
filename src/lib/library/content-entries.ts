"use client";

// Fetch-by-id for Library entry DETAIL content — see
// docs/perf-library-list-bundle.md ("What's still deferred") and
// supabase/schema.sql's `content_entries` table.
//
// DIRECT CLIENT READ, not an API route: this content is the same for every
// visitor (no per-user data, no auth needed), so `content_entries`' RLS is a
// public SELECT policy and the browser can query Supabase directly with the
// anon key — one fewer hop than routing through the app's own API. This is
// deliberately DIFFERENT from progress (src/lib/supabase/client.ts's own
// comment: "everything else goes through the app's own API routes, which use
// the server client under RLS") — progress is per-user and RLS-gated by
// auth.uid(), content is neither.

import { useEffect, useState } from "react";
import { createBrowserClient } from "@supabase/ssr";
import { supabasePublishableKey } from "@/lib/supabase/keys";
import type { EntryId } from "@/types";

let client: ReturnType<typeof createBrowserClient> | null = null;
function supabase() {
  if (!client) {
    client = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      supabasePublishableKey()!,
    );
  }
  return client;
}

/**
 * One entry's precomputed detail payload, or null if the entry has none (not
 * yet seeded, or a stale id history holds that the data no longer has — same
 * "outlives the data" fallback the rest of the app makes for a missing entry).
 * `T` is the caller's expected payload shape (e.g. a `Term`); this does not
 * validate it — the seed script and the reader agree on shape by convention,
 * the same way every other precompute in this app does.
 */
export async function fetchContentEntry<T>(entryId: EntryId): Promise<T | null> {
  const { data, error } = await supabase()
    .from("content_entries")
    .select("payload")
    .eq("entry_id", entryId)
    .maybeSingle();
  if (error) {
    // A missing table/row is not the caller's bug to handle specially — treat
    // any read failure as "no detail available" and let the page fall back,
    // the same way a stale id already does.
    console.error("fetchContentEntry:", error.message);
    return null;
  }
  return (data?.payload as T | undefined) ?? null;
}

/**
 * The shared fetch-and-render pattern every entry-detail view built on
 * `content_entries` uses: `undefined` while loading, then the payload or
 * `null` (no such entry — the caller's `if (!x) return null` reads the same
 * whether that's "still loading" or "genuinely missing", matching how the
 * live components already treated a missing live lookup).
 */
/**
 * `entryId: null` skips the fetch entirely — for a caller that sometimes
 * already has the content live (see kana-entry-view.tsx, used both fetched-by-id
 * from the Library route and with a live item on the teach walk, which already
 * has the whole dictionary loaded and would rather not round-trip for it).
 */
export function useContentEntry<T>(entryId: EntryId | null): T | null | undefined {
  const [result, setResult] = useState<{
    entryId: EntryId;
    payload: T | null;
  } | null>(null);
  useEffect(() => {
    if (entryId === null) return;
    let alive = true;
    void fetchContentEntry<T>(entryId).then((p) => {
      if (alive) setResult({ entryId, payload: p });
    });
    return () => {
      alive = false;
    };
  }, [entryId]);
  // Treat a result for the previous id as loading instead of synchronously
  // clearing state in the effect. This prevents stale content on an id switch
  // and avoids the extra render React's effect lint correctly rejects.
  return entryId !== null && result?.entryId === entryId
    ? result.payload
    : undefined;
}

import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { supabaseSecretKey } from "@/lib/supabase/secret-key";

// The raw, session-less Supabase client for server code that runs OUTSIDE any
// user's cookie jar and needs the full-access service-role key — today, the
// two on-demand audio-synthesis routes (/api/tts, /api/pitch-tts) writing
// synthesized clips into Storage. Distinct from client.ts/server.ts/
// middleware.ts, which all wrap @supabase/ssr's cookie-aware clients for a
// signed-in user's own request. Both audio routes used to each call
// `createClient()` directly against the same two env values; this is the one
// place that construction happens now, so a future change to it (a retry
// policy, a different auth option) doesn't have to be made twice.

/**
 * The shared admin client, or null when the project isn't configured
 * (missing URL or secret key) — callers already have to fold that into their
 * own "not configured" response alongside their other preconditions (bucket,
 * voice roster), so a null return joins the same check rather than throwing.
 */
export function createAdminClient(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = supabaseSecretKey();
  if (!url || !serviceKey) return null;
  return createClient(url, serviceKey, { auth: { persistSession: false } });
}

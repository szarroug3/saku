"use client";

// The browser-side Supabase client, for the one thing the browser does directly
// with Supabase: sign-in on the login page (send the magic link, handle the
// OAuth redirect). Everything else — reading and writing progress — goes through
// the app's own API routes, which use the server client under RLS.

import { createBrowserClient } from "@supabase/ssr";

export function createSupabaseBrowserClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}

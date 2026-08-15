import "server-only";

// Whether Supabase is configured for this deployment — i.e. whether an account
// can exist at all.
//
// This used to be an explicit STORAGE_BACKEND switch that chose between a local
// FILE store (an always-signed-in implicit user writing history.json) and the
// hosted Supabase store. The file store is gone: "no Supabase session" now
// always means a signed-OUT visitor whose progress lives in this browser's
// localStorage (see store/local-progress.ts), which is the exact path a
// signed-out production user already took.
//
// So the only question left is "are the Supabase keys present". When they are
// (production, or a local run with .env.local), auth is possible: a request with
// a session is signed in and syncs to its `progress` row, a request without one
// is signed out and falls back to localStorage. When they are absent (a bare
// checkout, CI), nobody can sign in and everyone is the signed-out localStorage
// visitor — which is the intended local-dev default.

export function isSupabaseStore(): boolean {
  // Browser tests need the public Supabase connection for content_entries, but
  // must remain deterministic signed-out visitors. Keep that test-only auth
  // switch separate from the public content connection instead of erasing the
  // shared NEXT_PUBLIC_* variables (which also made every Library detail test
  // render an empty shell).
  if (process.env.SAKU_DISABLE_AUTH === "1") return false;
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
}

import "server-only";

// Which backend holds a user's progress. FILE is the default — local dev keeps
// reading and writing history.json / lists.json at the repo root exactly as
// before, with no auth and a single implicit "local" user. SUPABASE is opt-in
// via STORAGE_BACKEND=supabase (set in production on Vercel), where each user's
// two JSON blobs live in one row of the `progress` table, gated by RLS.
//
// Keeping this a separate switch from "are the Supabase keys present" is
// deliberate: the keys can be set locally (to test auth) while the store still
// points at files, so turning on the hosted backend is one explicit decision,
// not a side effect of having configured auth.

export function isSupabaseStore(): boolean {
  return process.env.STORAGE_BACKEND === "supabase";
}

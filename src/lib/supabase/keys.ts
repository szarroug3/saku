// Supabase's publishable key (sb_publishable_..., the replacement for the
// legacy anon key) — read directly, no fallback. Sam manages the actual
// values in .env.local and Vercel; this file's only job is naming the one
// env var everything should read.
//
// Only the PUBLISHABLE half lives here. The secret half (./secret-key.ts) is
// a separate, `server-only`-guarded file — the two must never share a module,
// or the guard on one would either block this client-safe function too, or
// (worse) fail to block the secret key from a client bundle.

/** The client-safe key. Safe to import from a browser context: NEXT_PUBLIC_*
 * values are inlined at build time regardless of which module reads them. */
export function supabasePublishableKey(): string | undefined {
  return process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
}

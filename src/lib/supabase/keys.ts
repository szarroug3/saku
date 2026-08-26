// Supabase's publishable/secret key migration: the legacy anon/service_role
// JWT-based API keys are being retired in favour of publishable
// (sb_publishable_...) and secret (sb_secret_...) keys. Both key types work
// simultaneously (Supabase's own migration guidance), so every reader here
// checks the new name FIRST and falls back to the legacy one — safe to ship
// before the dashboard side is flipped over, and safe to keep shipping after,
// until the legacy keys are actually disabled and these fallbacks can come
// out. See https://supabase.com/docs/guides/getting-started/migrating-to-new-api-keys.
//
// Only the PUBLISHABLE half lives here. The secret half (./secret-key.ts) is
// a separate, `server-only`-guarded file — the two must never share a module,
// or the guard on one would either block this client-safe function too, or
// (worse) fail to block the secret key from a client bundle.

/** The client-safe key — publishable once set, else the legacy anon key. Safe
 * to import from a browser context: NEXT_PUBLIC_* values are inlined at
 * build time regardless of which module reads them. */
export function supabasePublishableKey(): string | undefined {
  return (
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
}

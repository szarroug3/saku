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

// SAK-238: every Supabase client constructor (client.ts, server.ts,
// middleware.ts, plus content-entries.ts's public-content client and
// session-cookie.ts's cookie-key derivation) used to read these two env vars
// with a bare `!`. That is fine as long as the values are always present, but
// the moment one is missing or renamed in a deploy, the `!` lies about the
// type and the actual failure happens deep inside @supabase/ssr's client
// constructor (or a `new URL(undefined)`) as an opaque, unhandled crash —
// nothing here says "Supabase is not configured", just a stack trace pointing
// at a dependency.
//
// requireSupabaseUrl / requireSupabasePublishableKey below are the fix: the
// same values, but checked at the one point every caller already reads them,
// so a missing var fails LOUD and CLEAR in application code instead of
// silently inside a constructor. This is a per-call guard rather than a
// single app-wide startup check on purpose — these four call sites run in
// three different runtimes (browser, Node Server Components, Edge
// middleware) with no shared boot hook to hang a single check on, and a
// serverless function re-evaluates its module scope per cold start anyway,
// so a "startup check" would just be this same per-call check running once
// lazily. isSupabaseStore() (store/mode.ts) already answers "is Supabase
// configured at all" for the callers that can gate on it ahead of time
// (middleware, auth.ts); these two exist for the handful of call sites that
// construct a client unconditionally (a client-side sign-in/out click, the
// OAuth callback route, session refresh) where that gate cannot run first.
export class SupabaseConfigError extends Error {
  constructor(varName: string) {
    super(
      `Supabase is not configured: ${varName} is missing. Set it in the ` +
        "deployment's environment (see .env.example) before Supabase auth or sync can run.",
    );
    this.name = "SupabaseConfigError";
  }
}

/** process.env.NEXT_PUBLIC_SUPABASE_URL, or a clear SupabaseConfigError — see
 * the comment above for why this replaces a bare `!`. */
export function requireSupabaseUrl(): string {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) throw new SupabaseConfigError("NEXT_PUBLIC_SUPABASE_URL");
  return url;
}

/** supabasePublishableKey(), or a clear SupabaseConfigError — see the comment
 * above for why this replaces a bare `!`. */
export function requireSupabasePublishableKey(): string {
  const key = supabasePublishableKey();
  if (!key) throw new SupabaseConfigError("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");
  return key;
}

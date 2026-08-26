import "server-only";

// SAK-202: whether a request even has a Supabase session cookie, checked
// without touching next/headers or @supabase/ssr's cookie-backed client.
// Kept in its own module (rather than inline in auth.ts) so it stays a pure
// function of a cookie list — auth.ts's sessionUserId needs next/headers'
// cookies() for the real request, but this file's tests need none of that,
// since they call this function directly with a plain array.

import { isChunkLike } from "@supabase/ssr";

/** Supabase's own default cookie key for this project: `sb-<project-ref>-auth-token`,
 * chunked across multiple cookies (`<key>.0`, `<key>.1`, ...) when the session is
 * large. Neither @supabase/supabase-js nor @supabase/ssr exports this computation,
 * so it is derived here exactly the way supabase-js's SupabaseClient constructor
 * derives it internally: `sb-${new URL(supabaseUrl).hostname.split(".")[0]}-auth-token`
 * (node_modules/.pnpm/@supabase+supabase-js@2.110.8/.../src/SupabaseClient.ts).
 * createSupabaseServerClient (./server.ts) never overrides it via cookieOptions.name,
 * so this default is what is actually on the wire. */
function supabaseAuthCookieKey(): string {
  const projectRef = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!).hostname.split(".")[0];
  return `sb-${projectRef}-auth-token`;
}

/** Whether the request's cookies include this project's Supabase session cookie
 * (exact key or one of its chunks). Chunk matching reuses @supabase/ssr's own
 * isChunkLike — the same matcher the SDK uses to find its own cookies — rather
 * than reimplementing the `.0`, `.1`, ... suffix pattern by hand. */
export function hasSupabaseSessionCookie(requestCookies: { name: string }[]): boolean {
  const key = supabaseAuthCookieKey();
  return requestCookies.some((c) => isChunkLike(c.name, key));
}

import "server-only";

// Who the current request belongs to — the key every progress read and write is
// scoped by.
//
// There is exactly ONE source of identity now: the Supabase session. A request
// with a session is that signed-in user's uuid; a request without one — or a
// deployment with no Supabase keys at all — is NOT SIGNED IN. There is no
// implicit always-present local user any more: the signed-out visitor's progress
// lives in this browser's localStorage (see store/local-progress.ts), not in a
// server-side file under a placeholder id.
//
// "Not signed in" is not an empty history — it is the absence of an account,
// which the write API routes surface as 401 (AuthRequiredError) and the client
// turns into "save to localStorage" (progress-fetch.ts) or a redirect to /login.
// Absence of identity must not read as absence of data.

import { isSupabaseStore } from "@/lib/store/mode";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { hasSupabaseSessionCookie } from "@/lib/supabase/session-cookie";
import { cookies } from "next/headers";
import { cache } from "react";

export class AuthRequiredError extends Error {
  constructor() {
    super("not signed in");
    this.name = "AuthRequiredError";
  }
}

// SAK-202: a fresh production process's first hit to ANY page paid an extra
// ~1.2s here, on top of every page's own work — confirmed by timing two
// unrelated pages and seeing the identical delta, which means it was a shared
// cost, not page-specific. Two independent causes, each fixed below:
//
//   - a signed-OUT visitor still built a Supabase client and asked it to
//     revalidate a session that never existed. There is nothing to revalidate
//     when there is no session cookie, so that whole call chain is skippable.
//   - a signed-IN visitor's supabase.auth.getUser() always makes a live round
//     trip to Supabase's Auth server, deliberately, because it is more
//     trustworthy than reading a possibly-stale cookie. getClaims() gives the
//     same trust level for an asymmetrically-signed project (this one is,
//     confirmed via the dashboard's JWT Keys page): it verifies the JWT's
//     signature locally against a cached JWKS instead of over the network.
//     getClaims() falls back to getUser() itself when it can't verify locally
//     (symmetric key, no kid, no WebCrypto) — that fallback is the SDK's own,
//     not duplicated here, and its use is logged below since it would mean
//     this fix silently stopped paying off (e.g. a future key rotation back
//     to a symmetric secret).

/** The signed-in user's uuid, or null when there is no session — including when
 * Supabase is not configured, where nobody can be signed in. The one place the
 * session is read, so getUserId / currentUserId cannot answer differently. */
const sessionUserId = cache(async (): Promise<string | null> => {
  if (!isSupabaseStore()) return null;

  // No session cookie at all means there is nothing to revalidate — skip the
  // Supabase client and every network call it would make, entirely.
  const cookieStore = await cookies();
  if (!hasSupabaseSessionCookie(cookieStore.getAll())) return null;

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.getClaims();
  if (error || !data) return null;

  // Loud, not silent: if this ever fires, getClaims() took its own network
  // fallback instead of verifying locally, and the ~1.2s cost above is back
  // for this request.
  if (data.header.alg.startsWith("HS")) {
    console.warn(
      `auth: getClaims() fell back to a network verification (JWT alg is ${data.header.alg}, not asymmetric) — the SAK-202 local-verification path is not in effect for this request.`,
    );
  }

  return data.claims.sub;
});

/** The current user's id, or throw AuthRequiredError when there is no session.
 * The write path wants the throw: a write with no account is a 401, not a save
 * against nobody. */
export async function getUserId(): Promise<string> {
  const id = await sessionUserId();
  if (!id) throw new AuthRequiredError();
  return id;
}

/** The current user's id, or null when there is no session. The same question
 * getUserId asks, phrased so that "not signed in" is an answer instead of an
 * error — which is what a Server Component wants when it is deciding what to
 * render (and, in the root layout, whose history to seed). */
export async function currentUserId(): Promise<string | null> {
  return sessionUserId();
}

/** Whether the current request has a signed-in account — false for a signed-out
 * visitor and for a deployment with no Supabase keys. Unlike getUserId this never
 * throws: it is the "show the app or the landing?" question the home page asks,
 * where "not signed in" is an answer, not an error. */
export async function isSignedIn(): Promise<boolean> {
  return (await currentUserId()) !== null;
}

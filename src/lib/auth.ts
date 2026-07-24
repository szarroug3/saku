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

export class AuthRequiredError extends Error {
  constructor() {
    super("not signed in");
    this.name = "AuthRequiredError";
  }
}

/** The signed-in user's uuid, or null when there is no session — including when
 * Supabase is not configured, where nobody can be signed in. The one place the
 * session is read, so getUserId / currentUserId cannot answer differently. */
async function sessionUserId(): Promise<string | null> {
  if (!isSupabaseStore()) return null;
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.id ?? null;
}

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

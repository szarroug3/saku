import "server-only";

// Who the current request belongs to — the key every progress read and write is
// scoped by.
//
// In FILE mode there is no auth and one implicit user: `LOCAL_USER`. The file
// store ignores the id (there is one history.json), so this just lets every
// caller pass a userId unconditionally without branching on the backend.
//
// In SUPABASE mode the id is the signed-in user's uuid, read from the session.
// No session is not an empty history — it is "not signed in", which the API
// surfaces as 401 (AuthRequiredError) and the UI turns into a redirect to
// /login. Same distinction history.ts draws between "no file" and "unreadable":
// absence of identity must not read as absence of data.

import { isSupabaseStore } from "@/lib/store/mode";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const LOCAL_USER = "local";

export class AuthRequiredError extends Error {
  constructor() {
    super("not signed in");
    this.name = "AuthRequiredError";
  }
}

/** The current user's id, or throw AuthRequiredError in Supabase mode when there
 * is no session. In file mode always `LOCAL_USER`. */
export async function getUserId(): Promise<string> {
  if (!isSupabaseStore()) return LOCAL_USER;
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new AuthRequiredError();
  return user.id;
}

/** Whether the current request has an app user — true always in file mode (the
 * single local user), and in Supabase mode only when signed in. Unlike
 * getUserId this never throws: it is the "show the app or the landing?" question
 * the home page asks, where "not signed in" is an answer, not an error. */
export async function isSignedIn(): Promise<boolean> {
  if (!isSupabaseStore()) return true;
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return !!user;
}

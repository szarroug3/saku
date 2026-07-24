// One translation, in one place: an auth failure from a progress route → an HTTP
// response the client can act on.
//
// WHY THE ROUTES DON'T EACH DO THIS
// =================================
// The client's whole save-failure story rests on telling apart "the server said
// no, you're signed out" from every other outcome — a signed-out 401 is the
// signal to save to localStorage instead (see progress-fetch.ts). So the status
// code is load-bearing, and five routes each writing their own is five chances
// for one of them to answer 200 to a write that did not happen, or to bury the
// 401 that should have gone local.
//
// Only AuthRequiredError is spoken for here. A store failure (a Supabase read or
// write that errored) is nobody's tidy JSON body: it returns null so the route
// rethrows and Next logs it as the surprise it is, and the client treats the
// non-401 as "unavailable" (history-cache.outcomeForResponse) — nothing on
// screen changes and a queued write stays queued.

import "server-only";

import { AuthRequiredError } from "@/lib/auth";

const NO_STORE = { "Cache-Control": "no-store" };

/**
 * The error response for a thrown progress operation, or null if `e` is not one
 * this module knows how to speak for.
 *
 * Returning null rather than a generic 500 is deliberate: an error nobody
 * recognized should reach Next's own handler and be logged as the surprise it
 * is, not be flattened into a tidy JSON body that hides it.
 */
export function historyErrorResponse(e: unknown): Response | null {
  // Not signed in (no session). 401 so the client saves to localStorage rather
  // than treating it as data loss.
  if (e instanceof AuthRequiredError) {
    return Response.json(
      { error: e.message, code: "auth-required" },
      { status: 401, headers: NO_STORE },
    );
  }
  return null;
}

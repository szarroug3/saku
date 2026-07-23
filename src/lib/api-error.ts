// One translation, in one place: a history.ts failure → an HTTP response the
// client can act on.
//
// WHY THE ROUTES DON'T EACH DO THIS
// =================================
// Every /api route that touches history.json can now FAIL, where before they
// all silently succeeded against an empty history (see HistoryUnreadableError).
// The client's whole save-failure story rests on telling apart "the server said
// no" from "the server said yes" — so the status code and the message shape are
// load-bearing, and five routes each writing their own is five chances for one
// of them to answer 200 to a write that did not happen.
//
// 503, not 500: the request was fine and the server is fine — the DATA FILE is
// in a state a human has to look at. That is a "try again later, after someone
// fixes something" condition, and it is the difference between a client that
// keeps its queued record and one that throws it away as a bad request.

import "server-only";

import { AuthRequiredError } from "@/lib/auth";
import { HistoryUnreadableError } from "@/lib/history";

const NO_STORE = { "Cache-Control": "no-store" };

/**
 * The error response for a thrown history operation, or null if `e` is not one
 * this module knows how to speak for.
 *
 * Returning null rather than a generic 500 is deliberate: an error nobody
 * recognized should reach Next's own handler and be logged as the surprise it
 * is, not be flattened into a tidy JSON body that hides it.
 */
export function historyErrorResponse(e: unknown): Response | null {
  // Not signed in (Supabase mode, no session). 401 so the client redirects to
  // /login rather than treating it as data loss.
  if (e instanceof AuthRequiredError) {
    return Response.json(
      { error: e.message, code: "auth-required" },
      { status: 401, headers: NO_STORE },
    );
  }
  if (!(e instanceof HistoryUnreadableError)) return null;
  return Response.json(
    {
      error: e.message,
      // Named so the client can say something specific rather than "something
      // went wrong", and so a future reader can branch without matching prose.
      code: "history-unreadable",
      path: e.path,
    },
    { status: 503, headers: NO_STORE },
  );
}

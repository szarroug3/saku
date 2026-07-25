"use client";

// The one place a progress write meets "what if I'm signed out".
//
// THE MECHANISM
// =============
// In Supabase mode a write returns 401 (AuthRequiredError → historyErrorResponse)
// when the server has no session for the request. What that 401 MEANS depends on
// whether an account exists at all — and the two meanings call for opposite
// responses. The decision lives in progress-write.ts (pure, unit-tested); these
// wrappers only supply the real fetch, the matching local op, and — for a
// signed-in retry — a Supabase session refresh. Outcomes:
//
//   2xx            → the server saved it. Nothing local happens.
//   401, signed OUT → this browser IS the store. Apply locally, report ok, and
//                    the outbox drops it — the work is durably saved.
//   401, signed IN  → a transient token lapse, NOT "no account". Refresh the
//                    session and retry the POST once. If it lands, done; if it
//                    still 401s, report NOT ok so the outbox keeps the record and
//                    the save banner shows. NEVER written to local, NEVER a false
//                    ok — a signed-in learner's write belongs on the server.
//   503 / network  → a signed-IN failure (unreadable file, offline, server
//                    down). Report NOT ok, write nothing local. The caller's
//                    existing retry/queue behavior handles these unchanged.
//
// "Signed in?" is a bit these plain modules cannot read for themselves; the app
// shell hands it over through auth-mode.ts (see isSignedIn / setAuthMode).
//
// THE BUG THIS BRANCH CLOSES
// ==========================
// A signed-in write used to take the signed-OUT path on 401: applyLocal + report
// ok + drop from the outbox. For a signed-in learner whose access token had just
// lapsed (common on mobile / multi-device, where Supabase rotates tokens), a
// finished round was written only to that device's localStorage, reported saved,
// and dropped from retry with no banner — the write never reached the server.
// That silently stranded a real user's progress on their phone.
//
// WHY WRAPPERS AND NOT A SHARED fetch()
// =====================================
// Each endpoint's local twin needs the parsed intent (which facts, which
// record, reset vs delete), so the branch to the right local op lives beside the
// branch to the right URL. Callers get a small typed result and keep their own
// refresh()/acknowledge() afterwards — the wrapper decides "server or local",
// the caller decides "what to do once it's saved", and neither reaches into the
// other.

import { isSignedIn } from "@/lib/auth-mode";
import { notifyHistoryWrite } from "@/lib/history-events";
import {
  resolveProgressWrite,
  type ProgressResult,
} from "@/lib/progress-write";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import {
  localAddToList,
  localClaim,
  localClearMixup,
  localDeleteList,
  localDeleteSessions,
  localDropClaim,
  localRemoveFromList,
  localDropSeen,
  localRenameList,
  localResetHistory,
  localSaveList,
  localSeen,
  localSession,
} from "@/lib/store/local-progress";
import type { EntryId, FactId, QuizSessionRecord, SavedList } from "@/types";

const JSON_HEADERS = { "Content-Type": "application/json" };

export type { ProgressResult };

/** Refresh this browser's Supabase session before a signed-in retry, rotating to
 * a fresh access token so the retried POST carries a valid cookie. Resolves
 * whether or not the refresh succeeded — a genuinely dead session just makes the
 * retry 401 again, which is exactly the "keep it queued" signal we want.
 *
 * Exported so the sign-in migration replay (migrate-local.ts) recovers from the
 * SAME lapsed-token 401 the same way, instead of stalling until the next load. */
export async function refreshSupabaseSession(): Promise<void> {
  await createSupabaseBrowserClient().auth.refreshSession();
}

/**
 * POST `body` to `url`, then let resolveProgressWrite decide the outcome — the
 * status/auth branching (including the signed-in refresh + retry) lives there
 * once so no endpoint can get it subtly wrong. This wrapper only supplies the
 * real IO: the fetch, the local op, the current auth bit, and the refresh.
 */
function postWithLocalFallback(
  url: string,
  body: unknown,
  applyLocal: () => void,
): Promise<ProgressResult> {
  return resolveProgressWrite({
    send: () =>
      fetch(url, {
        method: "POST",
        headers: JSON_HEADERS,
        body: JSON.stringify(body),
      }),
    applyLocal,
    signedIn: isSignedIn(),
    refreshSession: refreshSupabaseSession,
  });
}

/**
 * Announce a saved history write, so the app's one copy of the history knows to
 * re-read it (see history-events.ts). Wrapped around the four history wrappers
 * below and not around the list ones, which change a different file.
 *
 * Only on `ok`: a refused or dropped write changed nothing, and refetching after
 * one would just replace the screen with what it already shows.
 */
async function announcing(write: Promise<ProgressResult>): Promise<ProgressResult> {
  const result = await write;
  if (result.ok) notifyHistoryWrite();
  return result;
}

/** "I know these" / "actually, I don't". Mirrors POST /api/claim. On 401 the
 * claim (or its withdrawal) is recorded in this browser instead. */
export function postClaim(facts: FactId[], known: boolean): Promise<ProgressResult> {
  return announcing(
    postWithLocalFallback("/api/claim", { facts, known }, () =>
      known ? localClaim(facts, Date.now()) : localDropClaim(facts),
    ),
  );
}

/** "Quiz me". Mirrors POST /api/seen. On 401 the seen record goes local. */
export function postSeen(facts: FactId[]): Promise<ProgressResult> {
  return announcing(
    postWithLocalFallback("/api/seen", { facts }, () => localSeen(facts, Date.now())),
  );
}

/**
 * Withdraw seen marks. Mirrors POST /api/seen with `remove: true`.
 *
 * The roll-back a DISCARDED curriculum lesson runs: its start marked the lesson
 * (and the readings its words prove) seen, which advanced the frontier; discard
 * takes those marks back so the frontier lands exactly where it was before the
 * start. On 401 the withdrawal happens in this browser's local history, and the
 * announce revalidates the shared copy either way. */
export function postUnseen(facts: FactId[]): Promise<ProgressResult> {
  return announcing(
    postWithLocalFallback("/api/seen", { facts, remove: true }, () =>
      localDropSeen(facts),
    ),
  );
}

/** "Clear now" for a confusion pair. The timestamp is shared with the
 * optimistic update so the screen and durable copy establish the same floor. */
export function postClearMixup(
  key: string,
  ts: number,
): Promise<ProgressResult> {
  return announcing(
    postWithLocalFallback("/api/mixup", { key, ts }, () =>
      localClearMixup(key, ts),
    ),
  );
}

/**
 * A finished round. Mirrors POST /api/session, and is the ONE wrapper the
 * pending-records outbox drives (see flushPending in quiz-session.tsx).
 *
 * On 401 the record is written to local history AND reported ok, which is what
 * lets the outbox DROP it: signed out, the round is durably saved — in
 * localStorage — so it must not sit in the queue retrying a POST that will 401
 * forever. On 503/offline `ok` is false and the record stays queued, exactly as
 * before. localSession dedupes on id, so a record applied locally and later
 * (after sign-in) replayed to the server cannot be counted twice.
 */
export function postSession(record: QuizSessionRecord): Promise<ProgressResult> {
  return announcing(
    postWithLocalFallback("/api/session", record, () => localSession(record)),
  );
}

/**
 * Delete sessions, or reset everything. Mirrors POST /api/delete. `reset` routes
 * to the full local wipe; otherwise it is a local delete of the same ids/all.
 * On 401 the deletion happens in this browser and is reported ok, so the calling
 * screen's refresh() then re-reads the (now smaller) local history.
 */
export function postDelete(body: {
  ids?: (number | string)[];
  all?: boolean;
  reset?: boolean;
}): Promise<ProgressResult> {
  return announcing(
    postWithLocalFallback("/api/delete", body, () => {
      if (body.reset) localResetHistory();
      else localDeleteSessions(body.ids ?? null, body.all ?? false);
    }),
  );
}

// ---------- lists ----------

/**
 * One of the four list writes POST /api/lists accepts, discriminated by which
 * key is present — the same union the route and useLists already speak. Restated
 * here (rather than imported from the route, which is server-only) so the local
 * fallback can branch to the matching local op.
 */
export type ListWrite =
  | { addTo: string; entries: EntryId[] }
  | { removeFrom: string; entries: EntryId[] }
  | { rename: string; name: string }
  | SavedList;

/**
 * A list write. Mirrors POST /api/lists. On 401 the same edit is made to this
 * browser's local lists — the derived-list guard rides along inside the shared
 * list-ops, so a signed-out add to a rule is refused exactly as the server
 * refuses it.
 */
export function postList(body: ListWrite): Promise<ProgressResult> {
  return postWithLocalFallback("/api/lists", body, () => {
    if ("addTo" in body && body.addTo !== undefined) {
      localAddToList(body.addTo, body.entries);
    } else if ("removeFrom" in body && body.removeFrom !== undefined) {
      localRemoveFromList(body.removeFrom, body.entries);
    } else if ("rename" in body && body.rename !== undefined) {
      localRenameList(body.rename, body.name);
    } else {
      localSaveList(body as SavedList);
    }
  });
}

/** Delete a whole list. Mirrors DELETE /api/lists?id=…. On 401 the list is
 * dropped from this browser's local lists. */
export function deleteList(id: string): Promise<ProgressResult> {
  return postWithLocalFallbackRequest(
    () =>
      fetch(`/api/lists?id=${encodeURIComponent(id)}`, { method: "DELETE" }),
    () => localDeleteList(id),
  );
}

/**
 * As postWithLocalFallback, but the caller supplies the whole request — DELETE
 * carries its argument in the query string, not a JSON body, so it cannot go
 * through the POST helper. Same decision (signed-out local, signed-in refresh +
 * retry), one implementation apart only in how the request is built.
 */
function postWithLocalFallbackRequest(
  send: () => Promise<Response>,
  applyLocal: () => void,
): Promise<ProgressResult> {
  return resolveProgressWrite({
    send,
    applyLocal,
    signedIn: isSignedIn(),
    refreshSession: refreshSupabaseSession,
  });
}

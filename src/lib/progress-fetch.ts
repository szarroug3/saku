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
//   signed OUT      → this browser IS the store, and the shell has said so, so
//                    the write is applied here and now and the POST is not made
//                    at all (SAK-406 — see postWithLocalFallback). Reported ok:
//                    the work is durably saved and the outbox drops it.
//   401, signed OUT → the same outcome, reached the long way, for the callers
//                    that supply their own auth bit rather than reading the
//                    shell's (settings-provider.ts, store/migrate-local.ts).
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
  localClaim,
  localClearMixup,
  localDeleteSessions,
  localDropClaim,
  localDropSeen,
  localResetHistory,
  localSeen,
  localSession,
} from "@/lib/store/local-progress";
import type { FactId, QuizSessionRecord } from "@/types";

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
 *
 * SIGNED OUT, THE WRITE DOES NOT WAIT ON THE NETWORK (SAK-406).
 * ============================================================
 * When the shell has told us there is no account, the POST below is a foregone
 * 401: every one of these routes loads the user through getUserId(), which
 * throws before it reads the body. The 401 branch then does the only thing that
 * was ever going to happen — apply the op to this browser's copy. So it happens
 * here instead, in the caller's own turn, and the round trip is not made.
 *
 * That is not only a saved request. It closes a window in which a visitor's
 * work did not exist yet: a finished quiz was durable only after the response
 * came back, so navigating away in between lost it, which is what made the
 * sessions e2e flake under load. Now the record is in localStorage before this
 * function returns to its caller.
 *
 * The condition is `isSignedIn() === false` and not "not signed in": the signal
 * reads TRUE while unknown (see auth-mode.ts), so a write made before the shell
 * has spoken still takes the full path and is still queued rather than written
 * to a browser-local store the learner may not own. The signed-in path — refresh
 * and retry, never local, never a false ok — is untouched.
 */
function postWithLocalFallback(
  url: string,
  body: unknown,
  applyLocal: () => void,
): Promise<ProgressResult> {
  if (!isSignedIn()) {
    applyLocal();
    // 401 is what the server would have said, and what the signed-out branch of
    // resolveProgressWrite reports for exactly this outcome. Callers read `ok`;
    // the status stays truthful for the one that might not.
    return Promise.resolve({ ok: true, status: 401 });
  }
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

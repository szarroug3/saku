"use client";

// The one place a progress write meets "what if I'm signed out".
//
// THE MECHANISM
// =============
// In Supabase mode a signed-out write returns 401 (AuthRequiredError →
// historyErrorResponse). These wrappers catch exactly that status and, instead
// of letting the write vanish, apply the SAME operation to this browser's local
// store (see store/local-progress.ts) and report success. Every other outcome is
// passed through untouched:
//
//   2xx            → the server saved it. Nothing local happens.
//   401            → signed out. Apply locally, report ok. This is the fallback.
//   503 / network  → a signed-IN failure (unreadable file, offline, server
//                    down). Report NOT ok, write nothing local. The caller's
//                    existing retry/queue behavior must handle these unchanged —
//                    a network blip is not a reason to fork a signed-in learner's
//                    history into localStorage.
//
// So the local fallback is keyed on the ONE status that means "there is no
// account to write to", and nothing else. A signed-out learner's buttons now
// persist; a signed-in learner's durability story (pending-records.ts, the 503
// banner) is exactly as it was.
//
// WHY WRAPPERS AND NOT A SHARED fetch()
// =====================================
// Each endpoint's local twin needs the parsed intent (which facts, which
// record, reset vs delete), so the branch to the right local op lives beside the
// branch to the right URL. Callers get a small typed result and keep their own
// refresh()/acknowledge() afterwards — the wrapper decides "server or local",
// the caller decides "what to do once it's saved", and neither reaches into the
// other.

import {
  localAddToList,
  localClaim,
  localDeleteList,
  localDeleteSessions,
  localDropClaim,
  localRemoveFromList,
  localRenameList,
  localResetHistory,
  localSaveList,
  localSeen,
  localSession,
} from "@/lib/store/local-progress";
import type { EntryId, FactId, QuizSessionRecord, SavedList } from "@/types";

const JSON_HEADERS = { "Content-Type": "application/json" };

/** What a wrapped write reports back. `ok` folds "the server saved it" and "I
 * saved it locally because you're signed out" into the one question a caller
 * asks — is this piece of work safe now. `status` is the raw HTTP status (0 for
 * a network failure) for the rare caller that wants to tell the two apart. */
export interface ProgressResult {
  ok: boolean;
  status: number;
}

/**
 * POST `body` to `url`; on a 401 run `applyLocal` and report ok. The shared body
 * of every wrapper below — the status branching lives here once so no endpoint
 * can get the "401 means local, everything else means pass through" rule subtly
 * wrong.
 */
async function postWithLocalFallback(
  url: string,
  body: unknown,
  applyLocal: () => void,
): Promise<ProgressResult> {
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: JSON_HEADERS,
      body: JSON.stringify(body),
    });
    if (res.status === 401) {
      // Signed out: there is no server row, so this browser IS the store.
      applyLocal();
      return { ok: true, status: 401 };
    }
    return { ok: res.ok, status: res.status };
  } catch {
    // Offline or unreachable — NOT a signed-out 401, so nothing goes local. The
    // caller treats this like any pre-existing failure (swallow, or keep queued).
    return { ok: false, status: 0 };
  }
}

/** "I know these" / "actually, I don't". Mirrors POST /api/claim. On 401 the
 * claim (or its withdrawal) is recorded in this browser instead. */
export function postClaim(facts: FactId[], known: boolean): Promise<ProgressResult> {
  return postWithLocalFallback(
    "/api/claim",
    { facts, known },
    () => (known ? localClaim(facts, Date.now()) : localDropClaim(facts)),
  );
}

/** "Quiz me". Mirrors POST /api/seen. On 401 the seen record goes local. */
export function postSeen(facts: FactId[]): Promise<ProgressResult> {
  return postWithLocalFallback("/api/seen", { facts }, () =>
    localSeen(facts, Date.now()),
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
  return postWithLocalFallback("/api/session", record, () => localSession(record));
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
  return postWithLocalFallback("/api/delete", body, () => {
    if (body.reset) localResetHistory();
    else localDeleteSessions(body.ids ?? null, body.all ?? false);
  });
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
 * through the POST helper. Same 401-means-local rule, one implementation apart
 * only in how the request is built.
 */
async function postWithLocalFallbackRequest(
  send: () => Promise<Response>,
  applyLocal: () => void,
): Promise<ProgressResult> {
  try {
    const res = await send();
    if (res.status === 401) {
      applyLocal();
      return { ok: true, status: 401 };
    }
    return { ok: res.ok, status: res.status };
  } catch {
    return { ok: false, status: 0 };
  }
}

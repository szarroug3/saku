// The decision at the heart of a progress write: a POST came back, what do we do
// with it — and, crucially, what does a 401 MEAN.
//
// THE TWO MEANINGS OF 401, AND WHY THEY ARE OPPOSITE
// ==================================================
// In Supabase mode a write returns 401 when the server has no session for the
// request. That happens in two completely different situations:
//
//   SIGNED OUT — there is no account at all. This browser IS the store, so the
//     right move is to apply the same write locally and report success: the work
//     is durably saved (in localStorage) and the outbox can drop it, because a
//     POST that will 401 forever must not spin.
//
//   SIGNED IN, token lapsed — an account exists and the write belongs on the
//     server, but this request's access token had just expired (Supabase rotates
//     tokens; on mobile / multiple devices a request can race a rotation). The
//     record must NOT go to localStorage and must NOT be reported saved — doing
//     either strands a real user's progress on one device and drops it from the
//     retry queue with no banner. The right move is to refresh the session and
//     retry the POST once; if that still 401s the session is genuinely dead, so
//     report NOT ok and let the outbox keep the record queued (banner shows).
//
// Telling those apart needs one bit the raw fetch cannot see — is there an
// account — which the app knows and hands to the write path via auth-mode.ts.
//
// This module is the pure control flow of that decision, with every side effect
// (the POST itself, the local apply, the session refresh) injected. It imports
// nothing from the DOM, Supabase, or the local store, so it is unit-testable
// directly: see progress-write.test.ts. progress-fetch.ts is the one caller that
// supplies the real fetch / refresh / applyLocal.

/** What a wrapped write reports back. `ok` folds "the server saved it" and "I
 * saved it locally because you're signed out" into the one question a caller
 * asks — is this piece of work safe now. `status` is the raw HTTP status (0 for
 * a network failure) for the rare caller that wants to tell the two apart. */
export interface ProgressResult {
  ok: boolean;
  status: number;
}

/** The only bits of a fetch Response this decision reads. A real Response
 * satisfies it structurally; a test can hand over a plain object. */
export interface WriteResponse {
  ok: boolean;
  status: number;
}

/** Everything the decision needs, with all IO injected so the control flow can
 * be tested without a network, a DOM, or Supabase. */
export interface WriteDeps {
  /** Perform the request. Called once normally, and a SECOND time as the retry
   * after a signed-in refresh. Each call must build a fresh request. */
  send: () => Promise<WriteResponse>;
  /** Apply the same write to this browser's local store. Signed-out 401 only. */
  applyLocal: () => void;
  /** Is there a server account this write belongs to? See auth-mode.ts — this is
   * `true` when unknown, so an uninitialised signal keeps data queued rather than
   * dropping it. */
  signedIn: boolean;
  /** Refresh the browser session (rotate to a fresh access token) before the
   * signed-in retry. Resolves whether or not the refresh actually worked — a
   * dead session simply makes the retry 401 again. */
  refreshSession: () => Promise<void>;
}

/**
 * Run a progress write and resolve what happened. The 401 branching lives here
 * once so no endpoint can get it subtly wrong.
 *
 *   send throws      → network/offline. { ok:false, status:0 }. Nothing local —
 *                      a blip is not a reason to fork a signed-in learner's
 *                      history into localStorage, and the caller keeps it queued.
 *   status !== 401   → pass through untouched (2xx saved it; 503 keeps it queued).
 *   401, signed OUT  → applyLocal, { ok:true, status:401 }. This browser is the
 *                      store; the outbox drops it because it is durably saved.
 *   401, signed IN   → refreshSession, then retry the POST ONCE.
 *                        retry ok       → return it (the write landed). No local.
 *                        retry 401/fail → { ok:false, status } so the outbox
 *                                         KEEPS it and the save banner shows.
 *                      NEVER applyLocal, NEVER a false ok — a signed-in learner's
 *                      write belongs on the server and must not be dropped.
 */
export async function resolveProgressWrite(deps: WriteDeps): Promise<ProgressResult> {
  let res: WriteResponse;
  try {
    res = await deps.send();
  } catch {
    return { ok: false, status: 0 };
  }

  if (res.status !== 401) {
    return { ok: res.ok, status: res.status };
  }

  // A 401. The one status that forks on whether an account exists.
  if (!deps.signedIn) {
    // Signed out: there is no server row, so this browser IS the store.
    deps.applyLocal();
    return { ok: true, status: 401 };
  }

  // Signed in: a 401 is a transient auth lapse, not "no account". Refresh the
  // session and retry the POST once. Deliberately no applyLocal and no ok:true —
  // this write belongs on the server, and if the retry fails it stays queued.
  try {
    await deps.refreshSession();
    const retry = await deps.send();
    return { ok: retry.ok, status: retry.status };
  } catch {
    // The refresh or the retry threw (offline mid-refresh, say). Keep it queued.
    return { ok: false, status: 0 };
  }
}

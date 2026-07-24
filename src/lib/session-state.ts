// The IN-PROGRESS session state, as a syncable blob — Sync Part 2.
//
// WHAT THIS IS, AND WHAT IT IS NOT
// ================================
// A half-answered quiz already lives in this browser's localStorage, under
// `saku-session` (the StoredSession in quiz-session.tsx: the focused run's leg +
// runtime, the session loop it belongs to, and any parked runs). That copy is
// per-device and thrown away when the session ends. This module is what lets the
// SAME half-answered quiz appear on another device: it wraps that localStorage
// payload in a small ENVELOPE (an id + a timestamp) so two devices can compare
// their copies and agree on which is fresher, and it serializes enough to resume
// at the exact spot — because the payload already carries the cursor (the drill's
// deck position and current question, or the session's phase + round).
//
// This is a SEPARATE CHANNEL from the finished-round outbox (pending-records.ts →
// /api/session). That posts rounds you COMPLETED, folded into history forever.
// This posts the run you are STILL DOING, last-writer-wins, cleared the moment it
// finishes. The two must never touch: a stale in-progress copy resurrecting a
// finished run is exactly the class of bug lesson-resume.ts and the continue-
// session history are about, so a completed run CLEARS its blob here (state:null)
// with a newer timestamp, and every reconcile drops it.
//
// THE PAYLOAD IS OPAQUE ON PURPOSE. Its shape is quiz-session.tsx's business (a
// "use client" module this one must not import — it has to load server-side in
// the API route and in plain-Node tests). This module only MOVES the payload,
// KEYS it, and picks a WINNER between two copies. Everything here is pure — no
// React, no window, no server-only — so the route, the client provider and the
// tests all import the same code.
//
// LAST-WRITER-WINS, BY updatedAt. Two copies of the state are reconciled by
// comparing `updatedAt`: the device that saved more recently wins the whole
// document. `sessionId` rides along as the run's identity — it scopes a clear to
// the run it is clearing and lets a reader tell "the same session, updated" from
// "a different session" — but the WINNER is decided by the timestamp. That is the
// documented simplification: we do not merge two live runs field-by-field; the
// realistic case is a sequential hand-off (start on the computer, pick up on the
// phone), and whole-document LWW resolves it exactly right. Two devices actively
// driving DIFFERENT runs at the same moment resolve by whoever wrote last — the
// other run stays safe in its own device's localStorage, it just does not win the
// synced slot. See the provider for where the reconcile runs (on load, before any
// local write) so an adopted clear cannot be re-posted.

/** The in-progress session payload, kept OPAQUE — see the header. It is the
 * StoredSession minus its device-local `owner` stamp and its terminal `results`
 * view (neither teleports): the focused leg + runtime, the session loop, the
 * live progress, and the parked runs. `null` means "no session in progress" — a
 * document that was cleared because its run finished or was discarded. */
export type SessionPayload = Record<string, unknown>;

/** The wire shape stored in the `session` jsonb column (Supabase) / session.json
 * (file mode) and passed to and from the client. */
export interface SessionStateEnvelope {
  /** The current in-progress run's identity, or null when there is no run. Used
   * to scope a clear and to recognise "same session, updated"; the LWW winner is
   * decided by `updatedAt`, not this. */
  sessionId: string | null;
  /** Milliseconds since epoch when the WINNING device last wrote. The whole of
   * the last-writer-wins comparison. 0 for the empty envelope, so any real write
   * beats "never written". */
  updatedAt: number;
  /** The opaque in-progress payload, or null when the run finished / was cleared.
   * A null with a fresh `updatedAt` is how a completed run tells every other
   * device to drop it. */
  state: SessionPayload | null;
}

/** The "nothing here yet" envelope — an unset column, a missing file, a corrupt
 * blob all read as this. updatedAt 0 so the first real write always wins. */
export const EMPTY_ENVELOPE: SessionStateEnvelope = {
  sessionId: null,
  updatedAt: 0,
  state: null,
};

/** A plain JSON object — not null, not an array. */
function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/**
 * Coerce whatever came off the wire (or out of a jsonb column, or a file) into a
 * well-formed envelope. Anything unrecognisable reads as EMPTY_ENVELOPE — a
 * missing column, an old shape, half-written JSON — the same disposable-read
 * rule settings.ts uses, and correct here because the in-progress state is a
 * cache of a run you can always just keep doing on the device that has it.
 */
export function normalizeEnvelope(raw: unknown): SessionStateEnvelope {
  if (!isPlainObject(raw)) return EMPTY_ENVELOPE;
  const sessionId = typeof raw.sessionId === "string" ? raw.sessionId : null;
  const updatedAt =
    typeof raw.updatedAt === "number" && Number.isFinite(raw.updatedAt)
      ? raw.updatedAt
      : 0;
  // The payload is opaque, but it must be a plain object (a run) or null (no run).
  // An array or a primitive in `state` is a corrupt write, read as "no run".
  const state = isPlainObject(raw.state) ? (raw.state as SessionPayload) : null;
  return { sessionId, updatedAt, state };
}

/** Does this envelope carry a live in-progress run? A cleared/empty envelope
 * (state null) does not — which is what a reconcile that adopts a clear leaves,
 * and what tells a resume surface there is nothing to offer. */
export function envelopeHasSession(env: SessionStateEnvelope): boolean {
  return env.state !== null;
}

/** Build an envelope for the run currently on this device. `payload` null (no
 * active/parked run) makes a CLEAR — see clearedEnvelope, which is the named
 * spelling of that intent. */
export function makeEnvelope(
  payload: SessionPayload | null,
  sessionId: string | null,
  updatedAt: number,
): SessionStateEnvelope {
  return { sessionId, updatedAt, state: payload };
}

/**
 * The envelope a device publishes when its run FINISHES (Done, Discard, Clear
 * knowledge base) or a quiz reaches results: same id, a fresh timestamp, no
 * state. Because it is newer than any in-progress write for that run, every
 * reconcile drops the run — which is the whole defence against a finished run
 * being resurrected from a stale in-progress copy on another device.
 */
export function clearedEnvelope(
  sessionId: string | null,
  updatedAt: number,
): SessionStateEnvelope {
  return { sessionId, updatedAt, state: null };
}

/**
 * The last-writer-wins primitive: the fresher of two envelopes, by `updatedAt`.
 *
 * A tie (identical timestamps — same millisecond, or two "never written" empties)
 * keeps `a`. Callers pass their OWN copy as `a`, so a tie prefers the local
 * device: it is the one actively holding the run, and a coin-flip that could drop
 * a live run under the user's hands is worse than one that keeps it.
 */
export function pickNewer(
  a: SessionStateEnvelope,
  b: SessionStateEnvelope,
): SessionStateEnvelope {
  return b.updatedAt > a.updatedAt ? b : a;
}

/**
 * Reconcile this device's copy against another (the server's, on load; or an
 * incoming write, in the route). Returns the winner and whether it is the REMOTE
 * one — the single bit the caller acts on: adopt the remote state into the live
 * session when `adoptRemote`, otherwise the local copy already stands.
 *
 * Runs BEFORE any local write on load, which is what makes the clear safe: a
 * device holding a stale in-progress run seeds the server's newer clear here and
 * adopts it (dropping the run) before its own save effect could re-publish the
 * run it was holding. See the provider.
 */
export function reconcile(
  local: SessionStateEnvelope,
  remote: SessionStateEnvelope,
): { winner: SessionStateEnvelope; adoptRemote: boolean } {
  const winner = pickNewer(local, remote);
  return { winner, adoptRemote: winner === remote && remote !== local };
}

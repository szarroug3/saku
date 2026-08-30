import "server-only";

// Server-side persistence for a signed-in learner's IN-PROGRESS session state —
// Sync Part 2. The `session` jsonb on their `progress` row, beside history,
// lists and settings.
//
// WHO REACHES THIS. Only a signed-in request (getUserId → 401 otherwise). A
// signed-out visitor's in-progress run lives in this browser's localStorage
// snapshot, which is all a run needs to continue locally.
//
// A SEPARATE BLOB FROM history. `history` is what you FINISHED — folded into the
// aggregate forever. `session` is what you are STILL DOING — a single run
// envelope, last-writer-wins, cleared the moment the run ends. Different columns
// so a stale in-progress copy can never resurrect a finished run. Writing one
// leaves the other untouched (the upsert only sets the `session` column).
//
// THE WRITE APPLIES LAST-WRITER-WINS, THROUGH COMPARE-AND-SET (SAK-260). A POST
// does not blindly overwrite: it reconciles the incoming envelope against what
// is stored and keeps the fresher (by updatedAt) — but "what is stored" has to
// mean the row as it ACTUALLY IS at write time, not a snapshot read moments
// earlier. A plain read-then-write let two devices posting near-simultaneously
// each read the same row, each decide their OWN update was newer, and each
// blindly overwrite — so the intended guard never ran against the real state,
// and ordinary timing could drop a device's round despite the reconcile logic
// existing. mutateSessionStateWithRetry (session-mutate.ts) closes that: the
// reconcile runs under the same compare-and-set lists.ts and settings.ts use
// (SAK-220, SAK-258) — a write lands only if the row still carries the token a
// read saw, and a miss re-reads the winner and re-reconciles against it. So a
// POST that arrives stale (an out-of-order retry, a device that was offline)
// still cannot overwrite a newer write — including a newer CLEAR, which is what
// stops a finished run from being un-cleared by a straggling in-progress write
// — and two writes that truly overlap now serialize instead of racing.

import {
  normalizeEnvelope,
  pickNewer,
  type SessionStateEnvelope,
} from "@/lib/session-state";
import { mutateSessionStateWithRetry, type SessionStore } from "@/lib/session-mutate";
import {
  readSessionRow,
  readSessionRowVersioned,
  writeSessionRowGuarded,
} from "@/lib/store/supabase-store";

/** The compare-and-set store saveSessionState runs its read-reconcile-write
 * through, so two overlapping posts cannot each blindly overwrite the other.
 * One instance, since it is stateless — the request-bound Supabase client is
 * created per call inside these primitives. The twin of settings.ts's `store`. */
const store: SessionStore = {
  read: readSessionRowVersioned,
  write: writeSessionRowGuarded,
};

/** The signed-in learner's in-progress session envelope. readSessionRow
 * normalizes an unset column into the empty envelope (no synced run). */
export async function loadSessionState(
  userId: string,
): Promise<SessionStateEnvelope> {
  return readSessionRow(userId);
}

/**
 * Persist an incoming in-progress envelope, last-writer-wins, safe against a
 * concurrent writer.
 *
 * The reconcile itself is unchanged — pickNewer(stored, incoming), by
 * updatedAt, ties favoring the stored copy — but it now runs through
 * mutateSessionStateWithRetry's compare-and-set: the write only lands if the
 * row still matches what was just read, and a lost race re-reads the ACTUAL
 * winner and reruns pickNewer against it rather than trusting a stale
 * snapshot. Returns the stored winner so the client can reconcile its own
 * copy against it.
 */
export async function saveSessionState(
  userId: string,
  incoming: SessionStateEnvelope,
): Promise<SessionStateEnvelope> {
  const normalized = normalizeEnvelope(incoming);
  return mutateSessionStateWithRetry(store, userId, (stored) => pickNewer(stored, normalized));
}

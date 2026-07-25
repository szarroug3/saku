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
// THE WRITE APPLIES LAST-WRITER-WINS. A POST does not blindly overwrite: it
// reconciles the incoming envelope against what is stored and keeps the fresher
// (by updatedAt). So two devices posting near-simultaneously converge on the
// newer write regardless of arrival order, and a stale device that races a clear
// cannot un-clear a finished run just by arriving second. The reconcile logic
// lives in session-state.ts (pure, shared with the client and the tests).

import {
  normalizeEnvelope,
  pickNewer,
  type SessionStateEnvelope,
} from "@/lib/session-state";
import {
  readProgressSeedRow,
  readSessionRow,
  writeSessionRow,
} from "@/lib/store/supabase-store";

/** The signed-in learner's in-progress session envelope. readSessionRow
 * normalizes an unset column into the empty envelope (no synced run). */
export async function loadSessionState(
  userId: string,
): Promise<SessionStateEnvelope> {
  return readSessionRow(userId);
}

/** Session-only view over the grouped app-shell seed read. */
export async function loadSeedSessionState(
  userId: string,
): Promise<SessionStateEnvelope> {
  return (await readProgressSeedRow(userId)).session;
}

/** The write half — upserts only the `session` column. */
async function writeSessionState(
  userId: string,
  env: SessionStateEnvelope,
): Promise<void> {
  await writeSessionRow(userId, env);
}

/**
 * Persist an incoming in-progress envelope, last-writer-wins.
 *
 * Read-reconcile-write: load the stored envelope, keep whichever of it and the
 * incoming one is fresher (pickNewer, by updatedAt), write the winner back. So a
 * POST that arrives stale (an out-of-order retry, a device that was offline)
 * cannot overwrite a newer write — including a newer CLEAR, which is what stops a
 * finished run from being un-cleared by a straggling in-progress write. Returns
 * the stored winner so the client can reconcile its own copy against it.
 */
export async function saveSessionState(
  userId: string,
  incoming: SessionStateEnvelope,
): Promise<SessionStateEnvelope> {
  const winner = pickNewer(await loadSessionState(userId), normalizeEnvelope(incoming));
  await writeSessionState(userId, winner);
  return winner;
}

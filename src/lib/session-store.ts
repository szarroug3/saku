import "server-only";

// Server-side persistence for the learner's IN-PROGRESS session state — Sync
// Part 2. The fourth blob beside history, lists and settings.
//
// WHERE THE BLOB LIVES depends on STORAGE_BACKEND (see store/mode.ts): the local
// session.json at the repo root in file mode, or the per-user `session` jsonb on
// the `progress` row in Supabase in hosted mode. Same backend split as
// settings.ts — the one-line branch in loadSessionState / writeSessionState is
// all that changes between the two stores, and the LWW reconcile logic lives in
// session-state.ts (pure, shared with the client and the tests).
//
// A SEPARATE BLOB FROM history. `history` is what you FINISHED — folded into the
// aggregate forever. `session` is what you are STILL DOING — a single run
// envelope, last-writer-wins, cleared the moment the run ends. They are different
// columns / different files so a stale in-progress copy can never resurrect a
// finished run. Writing one leaves the other untouched (the upsert only sets the
// `session` column).
//
// THE WRITE APPLIES LAST-WRITER-WINS. A POST does not blindly overwrite: it
// reconciles the incoming envelope against what is stored and keeps the fresher
// (by updatedAt). So two devices posting near-simultaneously converge on the
// newer write regardless of arrival order, and a stale device that races a clear
// cannot un-clear a finished run just by arriving second.

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import path from "node:path";

import {
  EMPTY_ENVELOPE,
  normalizeEnvelope,
  pickNewer,
  type SessionStateEnvelope,
} from "@/lib/session-state";
import { isSupabaseStore } from "@/lib/store/mode";
import { readSessionRow, writeSessionRow } from "@/lib/store/supabase-store";

// WHERE the local file lives — the repo root by default, the same SAKU_DATA_DIR
// override history.ts / settings.ts document (the e2e suite points it at a
// throwaway directory; unset in every normal run).
const DATA_DIR = process.env.SAKU_DATA_DIR
  ? path.resolve(process.env.SAKU_DATA_DIR)
  : process.cwd();
const SESSION_PATH = path.join(DATA_DIR, "session.json");

/** Indent 1, no trailing newline — legible under `git diff`, same rule as the
 * other blobs. */
function writeSessionFile(env: SessionStateEnvelope): void {
  writeFileSync(SESSION_PATH, JSON.stringify(env, null, 1), "utf-8");
}

/** Read session.json. A missing or corrupt file reads as the empty envelope (no
 * synced run) — the disposable-read rule settings.ts uses, and correct here: an
 * absent file genuinely means "no run to teleport", a valid state, and the
 * in-progress run is never the only copy of anything (finished rounds are in
 * history via their own outbox). */
function readSessionFile(): SessionStateEnvelope {
  if (existsSync(SESSION_PATH)) {
    try {
      return normalizeEnvelope(JSON.parse(readFileSync(SESSION_PATH, "utf-8")));
    } catch {
      // missing/corrupt file yields the empty envelope
    }
  }
  return EMPTY_ENVELOPE;
}

/** The current backend's in-progress session envelope for `userId`. File mode
 * ignores the id (one session.json); Supabase reads the user's own row under
 * RLS. */
export async function loadSessionState(
  userId: string,
): Promise<SessionStateEnvelope> {
  return isSupabaseStore() ? readSessionRow(userId) : readSessionFile();
}

/** The write half — the same backend split. */
async function writeSessionState(
  userId: string,
  env: SessionStateEnvelope,
): Promise<void> {
  if (isSupabaseStore()) await writeSessionRow(userId, env);
  else writeSessionFile(env);
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

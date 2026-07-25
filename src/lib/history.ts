// Server-side persistence for a signed-in learner's history — the `history`
// jsonb on their `progress` row in Supabase.
//
// WHO REACHES THIS. Only a signed-in request: every /api route loads the userId
// through getUserId(), which throws AuthRequiredError (→ 401) when there is no
// session, so the read/write below is never called for a signed-out visitor.
// Their history lives in this browser's localStorage instead (store/
// local-progress.ts), applied with the SAME pure ops this file uses so the two
// paths stay identical down to the timestamp-forward re-claim and the id-dedupe.
//
// WHAT LIVES HERE is the read-modify-write LOGIC — the mutators below load the
// row, hand it to a pure op in history-ops.ts, and write the result back. Where
// the blob lives (the Supabase row) is store/supabase-store.ts; the ops are
// shared with the client. This file is the seam between the two.

import "server-only";

import {
  applyClearMixup,
  applyClaims,
  applyDeleteSessions,
  applyDropClaims,
  applyDropSeen,
  applySeen,
  applySession,
  emptyHistory,
} from "@/lib/history-ops";
import {
  readHistoryRow,
  readProgressSeedRow,
  writeHistoryRow,
} from "@/lib/store/supabase-store";
import type { FactId, HistoryFile, QuizSessionRecord } from "@/types";

/**
 * The signed-in learner's history. The read half every mutator below builds on.
 * readHistoryRow normalizes a missing/empty row into the day-one shell, so this
 * always returns a well-formed HistoryFile.
 */
export async function loadHistory(userId: string): Promise<HistoryFile> {
  return readHistoryRow(userId);
}

/** One read for the three app-shell seeds (history/settings/session), so layout
 * hydration can avoid three independent progress-row queries. */
export async function loadProgressSeeds(userId: string) {
  return readProgressSeedRow(userId);
}

/** The write half — upserts the `history` column, leaving lists/settings/session
 * untouched. */
async function writeHistory(userId: string, hist: HistoryFile): Promise<void> {
  await writeHistoryRow(userId, hist);
}

/**
 * Record "I know these" for a set of facts, at `ts`.
 *
 * Writes `claims` and NOTHING ELSE — not a session, not a count, not a fold.
 * See src/lib/claims.ts for why all three of those would be wrong; the short
 * version is that a claim is not something you did, and `facts` is rebuilt from
 * the things you did.
 *
 * Re-claiming an already-claimed fact MOVES its timestamp forward, which is the
 * intended reading: you are saying it again, today, and the model's confidence
 * should date from when you said it. Claiming is idempotent in effect and not in
 * time, and that asymmetry is the point — the belief decays, so re-asserting it
 * has to be able to refresh it.
 */
export async function saveClaims(
  userId: string,
  facts: FactId[],
  ts: number,
): Promise<HistoryFile> {
  const next = applyClaims(await loadHistory(userId), facts, ts);
  await writeHistory(userId, next);
  return next;
}

/**
 * Record "quiz me" for a set of facts, at `ts` — the group is now in your
 * knowledge base and fair game to drill, on your word.
 *
 * The twin of `saveClaims`: same write discipline (its own key, no session, no
 * count, no fold), same idempotent-in-effect-not-in-time re-recording (saying
 * "quiz me" again moves the timestamp forward, and the belief dates from when
 * you said it). What differs is only what the model does with the record — see
 * claims.seenState. Kept a separate function rather than a flag on saveClaims so
 * the two writes read as the two intents they are.
 */
export async function saveSeen(
  userId: string,
  facts: FactId[],
  ts: number,
): Promise<HistoryFile> {
  const next = applySeen(await loadHistory(userId), facts, ts);
  await writeHistory(userId, next);
  return next;
}

/** Withdraw claims — "actually, I don't". Deletes the record rather than
 * writing a zero: a fact with no claim is the state the app starts in and the
 * one every reader already handles, and an absent key says "never claimed"
 * where `0` would have to be special-cased into meaning it. */
export async function dropClaims(userId: string, facts: FactId[]): Promise<HistoryFile> {
  const next = applyDropClaims(await loadHistory(userId), facts);
  await writeHistory(userId, next);
  return next;
}

/** Withdraw "quiz me" records — the twin of dropClaims, used when a lesson is
 * DISCARDED to take back the seen marks its start laid down (see applyDropSeen).
 * Same delete-not-zero discipline: an absent key is "never seen", the state the
 * frontier reads as fresh again. */
export async function dropSeen(userId: string, facts: FactId[]): Promise<HistoryFile> {
  const next = applyDropSeen(await loadHistory(userId), facts);
  await writeHistory(userId, next);
  return next;
}

/** Retire an open confusion record at the learner's request. The underlying
 * sessions stay intact; the marker only sets the starting point for this
 * pair's future lifecycle. */
export async function clearMixup(
  userId: string,
  key: string,
  ts: number,
): Promise<HistoryFile> {
  const next = applyClearMixup(await loadHistory(userId), key, ts);
  await writeHistory(userId, next);
  return next;
}

/**
 * Append a session and fold its per-fact stats into the aggregate.
 *
 * Folds INCREMENTALLY onto the stored aggregate rather than replaying — which
 * is only sound because a new session is the newest one there is, so replaying
 * would visit it last anyway and land in the same place. That is a real
 * precondition now that the fold carries scoring state (order matters; see
 * aggregate.ts), and it is the reason this is still an append and not a rebuild.
 *
 * `hist.sessions.slice(-200)` drops the oldest sessions past the cap, and the
 * aggregate deliberately KEEPS what they taught it: the counts stay counted and
 * the stability stays where the evidence put it. A rebuild — deleteSessions —
 * cannot know that, and will quietly compute both from the surviving 200 only.
 * That predates this change for the counts; it now also costs stability, which
 * matters more per session. Noted rather than fixed: the cap and the rebuild
 * have disagreed since the file was written, and reconciling them is its own
 * change.
 */
export async function saveSession(
  userId: string,
  session: QuizSessionRecord,
): Promise<HistoryFile> {
  // IDEMPOTENT ON `id`, and the dedup path must NOT write. The client queues
  // records and retries them until the server acknowledges one, and a retry
  // whose original DID land (the response was lost, not the request) would
  // otherwise append the same round twice and double every count in it. The
  // fold, the 200-cap and the id-dedup all live in applySession now (see
  // history-ops.ts); when it returns the SAME object it was given, the record
  // was already stored, so writing again is pointless churn on the row.
  const hist = await loadHistory(userId);
  const next = applySession(hist, session);
  if (next !== hist) await writeHistory(userId, next);
  return next;
}

/** Remove sessions (by ts) or everything, then rebuild the per-fact aggregate
 * — counts AND scoring state — from what survives. See aggregate.foldSessions:
 * the replay is time-ordered, because stability depends on the order.
 *
 * `claims` and `seen` SURVIVE, and do so by construction rather than by a
 * filter: neither is derived from sessions, so a rebuild of what is has nothing
 * to say about them. Deleting your history discards what you DID. What you told
 * the app you know, and what you asked to be quizzed on, are separate assertions
 * and are still true. */
export async function deleteSessions(
  userId: string,
  ids: (number | string)[] | null,
  deleteAll: boolean,
): Promise<HistoryFile> {
  // A delete that selects NOTHING must change nothing AND must not write. The
  // rebuild folds hist.facts from the SURVIVING sessions, but hist.facts is
  // grown incrementally by saveSession and legitimately carries contributions
  // from sessions the 200-cap has already evicted from hist.sessions — so
  // rebuilding on an empty request would silently shrink the aggregate for a
  // request that asked to delete nothing. applyDeleteSessions owns the guard, the
  // id-vs-ts keying and the rebuild (see history-ops.ts) and returns the SAME
  // object on the no-op, so `next !== hist` is exactly "did anything change":
  // bail before writing when it did not.
  const hist = await loadHistory(userId);
  const next = applyDeleteSessions(hist, ids, deleteAll);
  if (next !== hist) await writeHistory(userId, next);
  return next;
}

/**
 * Full reset — restart from zero. Discards EVERYTHING that makes a fact known:
 * `sessions` (what you did), `claims` ("I already know this"), `seen` ("quiz
 * me"), and `facts` (the derived aggregate). The result is the day-one shell a
 * fresh install starts with, `{ sessions: [], facts: {} }`.
 *
 * DELIBERATELY NOT deleteSessions. That one drops sessions and by design PRESERVES
 * claims and seen (see its note, and the HistoryFile field docs) — they are
 * things you SAID, not things you did, and deleting a run must not silently
 * revoke an assertion. A reset is the opposite intent: the user is asking to
 * un-know everything, so the assertions go too.
 */
export async function resetAll(userId: string): Promise<HistoryFile> {
  const empty = emptyHistory();
  await writeHistory(userId, empty);
  return empty;
}

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

import { timed } from "@/lib/server-timing";
import "server-only";

import { foldSessions } from "@/lib/aggregate";
import { upsertSessionFacts } from "@/lib/fact-store";
import {
  applyClearMixup,
  applyClaims,
  applyDeleteSessions,
  applyDeleteSessionsMeta,
  applyDropClaims,
  applyDropClaimsMeta,
  applyDropSeen,
  applySeen,
  applySession,
  applySessionMeta,
  emptyHistory,
} from "@/lib/history-ops";
import {
  mutateHistoryWithRetry,
  mutateHistoryWithRetryTracked,
  type HistoryStore,
} from "@/lib/history-mutate";
import {
  deleteAllFactRows,
  deleteFactRows,
  factsTableMigrated,
  readFactRowsVersioned,
  readHistoryRow,
  readHistoryRowVersioned,
  readProgressSeedRow,
  replaceAllFactRows,
  writeHistoryRow,
  writeHistoryRowGuarded,
} from "@/lib/store/supabase-store";
import type { FactId, HistoryFile, QuizSessionRecord, SessionFactCounts } from "@/types";

/** The compare-and-set store the mutators below run their read-modify-write
 * through, so two overlapping requests cannot clobber each other's field (see
 * history-mutate.ts). One instance, since it is stateless — the request-bound
 * Supabase client is created per call inside these primitives. */
const store: HistoryStore = {
  read: readHistoryRowVersioned,
  write: writeHistoryRowGuarded,
};

/**
 * Apply a pure op to this user's history and persist it, safe against a
 * concurrent writer. The one seam every mutator below shares — the twin of
 * store/local-progress.ts's `mutateHistory`, with the concurrency guard the
 * shared server row needs and the single browser store does not.
 */
function mutateHistory(
  userId: string,
  op: (hist: HistoryFile) => HistoryFile,
): Promise<HistoryFile> {
  return mutateHistoryWithRetry(store, userId, op);
}

/**
 * The signed-in learner's history. The read half every mutator below builds on.
 * readHistoryRow normalizes a missing/empty row into the day-one shell, so this
 * always returns a well-formed HistoryFile.
 */
export async function loadHistory(userId: string): Promise<HistoryFile> {
  return timed("history", () => readHistoryRow(userId), "reading the learner's history");
}

/** One read for the app-shell's seeds, so layout hydration does not make its
 * own progress-row query. Only the settings are read now (SAK-376): the
 * history left the HTML in SAK-398 and the in-progress run envelope is gone. */
export async function loadProgressSeeds(userId: string) {
  return timed("seeds", () => readProgressSeedRow(userId), "the shell's progress row");
}

/** The write half — upserts the `history` column, leaving the others
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
  return mutateHistory(userId, (hist) => applyClaims(hist, facts, ts));
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
  return mutateHistory(userId, (hist) => applySeen(hist, facts, ts));
}

/**
 * Withdraw claims — "actually, I don't". Deletes the record rather than
 * writing a zero: a fact with no claim is the state the app starts in and the
 * one every reader already handles, and an absent key says "never claimed"
 * where `0` would have to be special-cased into meaning it.
 *
 * ALSO deletes the fact's quiz-performance aggregate (SAK-103 — see
 * applyDropClaims's doc for why). SAK-237: that delete no longer touches the
 * whole `facts` blob — it is a direct `DELETE ... WHERE fact_id IN (...)`
 * against progress_facts, checked FIRST so a not-yet-migrated account still
 * gets the original one-shot whole-document behaviour (applyDropClaims)
 * rather than silently losing the aggregate-delete half of this call.
 */
export async function dropClaims(userId: string, facts: FactId[]): Promise<HistoryFile> {
  const { migrated } = await deleteFactRows(userId, facts);
  if (!migrated) {
    return mutateHistory(userId, (hist) => applyDropClaims(hist, facts));
  }
  return mutateHistory(userId, (hist) => applyDropClaimsMeta(hist, facts));
}

/** Withdraw "quiz me" records — the twin of dropClaims, used when a lesson is
 * DISCARDED to take back the seen marks its start laid down (see applyDropSeen).
 * Same delete-not-zero discipline: an absent key is "never seen", the state the
 * frontier reads as fresh again. */
export async function dropSeen(userId: string, facts: FactId[]): Promise<HistoryFile> {
  return mutateHistory(userId, (hist) => applyDropSeen(hist, facts));
}

/** Retire an open confusion record at the learner's request. The underlying
 * sessions stay intact; the marker only sets the starting point for this
 * pair's future lifecycle. */
export async function clearMixup(
  userId: string,
  key: string,
  ts: number,
): Promise<HistoryFile> {
  return mutateHistory(userId, (hist) => applyClearMixup(hist, key, ts));
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
 *
 * SAK-237: THE SESSION-SIZED WRITE. Before this, every call here read AND
 * rewrote a learner's entire `facts` map — one round's dozen or so facts,
 * priced as if it were their whole curriculum history. Now:
 *
 *   1. `applySessionMeta` appends/dedupes/caps `sessions` and stamps
 *      `learnedAt`, WITHOUT touching `.facts` — a small, bounded document
 *      (≤200 sessions) regardless of lifetime fact count.
 *   2. Only the facts THIS session actually names get read (their current
 *      row, if any), folded, and written back — via fact-store.ts's
 *      upsertSessionFacts, each fact its own compare-and-set, in parallel.
 *
 * Both scale with the SESSION's size, not the account's. The one exception is
 * an account whose progress_facts table has not been created yet (see
 * store/supabase-store.ts's `migrated` flag): saveSession falls back to the
 * original one-shot `applySession` so a deploy that lands before
 * scripts/sql/add-progress-facts-table.sql does not break session saving.
 */
export async function saveSession(
  userId: string,
  session: QuizSessionRecord,
): Promise<HistoryFile> {
  const touched = Object.entries(session.facts ?? {}) as [FactId, SessionFactCounts][];

  if (touched.length === 0) {
    // Nothing to fold — the meta-only path is already the complete answer.
    return mutateHistory(userId, (hist) => applySessionMeta(hist, session));
  }

  // Read the touched facts' current rows FIRST, before touching the small
  // document — this is also how a not-yet-migrated account is detected, with
  // no separate probe query.
  const { rows, migrated } = await readFactRowsVersioned(userId, touched.map(([f]) => f));
  if (!migrated) {
    return mutateHistory(userId, (hist) => applySession(hist, session));
  }

  // IDEMPOTENT ON `id`, and the dedup path must NOT write and must NOT fold —
  // a retried record whose original attempt already landed already folded its
  // facts too. `applySessionMeta` returns the SAME reference in that case
  // (mirroring applySession's own no-op contract); `wrote: false` is that
  // signal surfacing through the tracked mutate.
  const { history, wrote } = await mutateHistoryWithRetryTracked(store, userId, (hist) =>
    applySessionMeta(hist, session),
  );
  if (wrote) {
    await upsertSessionFacts(userId, touched, session.ts, rows);
  }
  return history;
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
  // rebuild folds facts from the SURVIVING sessions, but facts are grown
  // incrementally by saveSession and legitimately carry contributions from
  // sessions the 200-cap has already evicted from hist.sessions — so
  // rebuilding on an empty request would silently shrink the aggregate for a
  // request that asked to delete nothing. applyDeleteSessions(Meta) owns the
  // guard, the id-vs-ts keying and (for the non-meta original) the rebuild,
  // and returns the SAME object on the no-op, so `wrote` is exactly "did
  // anything change": bail before writing/rebuilding when it did not.
  //
  // SAK-237: on a migrated account, the rebuild REPLACES the progress_facts
  // table with `foldSessions` of the survivors — bounded by the 200-session
  // cap, not by lifetime fact count, and the whole-document `facts` blob is
  // never read OR written for this. A not-yet-migrated account falls back to
  // the original one-shot applyDeleteSessions so the rebuild still lands
  // somewhere.
  if (!(await factsTableMigrated(userId))) {
    return mutateHistory(userId, (hist) => applyDeleteSessions(hist, ids, deleteAll));
  }
  const { history, wrote } = await mutateHistoryWithRetryTracked(store, userId, (hist) =>
    applyDeleteSessionsMeta(hist, ids, deleteAll),
  );
  if (wrote) {
    const rebuilt = foldSessions(history.sessions);
    await replaceAllFactRows(userId, rebuilt);
  }
  return history;
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
  // SAK-237: facts also live in progress_facts now — a reset has to wipe that
  // table too, or a fact untouched by any later session would keep reading
  // back from its old row forever. Best-effort no-op on a not-yet-migrated
  // account (nothing there to delete).
  await deleteAllFactRows(userId);
  return empty;
}

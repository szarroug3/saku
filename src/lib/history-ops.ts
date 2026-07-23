// The pure arithmetic of "what does this write DO to a history" — the same
// role list-ops.ts plays for lists, and for the same reason.
//
// WHY THIS EXISTS
// ===============
// history.ts owns durability: the atomic temp-file write, the "an unreadable
// file THROWS rather than reads as empty" quarantine, the file-vs-Supabase
// branch. All of that is `server-only` and none of it can be imported into a
// browser or a plain-Node test (the marker package throws). But the read of
// "does re-claiming move the timestamp", "does a same-id session dedupe", "does
// an empty delete leave the aggregate alone" is not durability — it is the
// meaning of the write, and until now it lived ONLY inside those server-only
// functions.
//
// Signed-out local save needs the exact same meaning applied to a localStorage
// copy (see src/lib/store/local-progress.ts): a signed-out learner's "I know
// these" has to move the same claim timestamp forward, a finished session has
// to dedupe on the same id, a delete has to rebuild the same aggregate — or the
// local copy is a second, subtly different history that then merges wrong. So
// the transforms are lifted here, where both the server file and the browser
// can call ONE definition, and history.ts calls straight through (load → op →
// write) so the two cannot drift. That is the identical move aggregate.ts and
// list-ops.ts already made.
//
// PURE, AND CLONE-IN CLONE-OUT
// ============================
// Every function takes a HistoryFile and returns a HistoryFile, and NEVER
// mutates its argument — it works on a structuredClone. history.ts used to
// mutate the object it had just loaded and write that same object; a caller
// holding a reference to the input and expecting it untouched is a browser
// concern the server never had (React state), so cloning is the safe default
// for shared code. The clone is cheap next to a disk or network write.
//
// THE NO-OP CONTRACT: two operations have a "nothing changed, so change
// nothing" case that history.ts deliberately does NOT write to disk for —
// re-posting a session whose id is already stored, and a delete that selects
// nothing (see the notes in history.ts). Those two return the SAME reference
// they were given, unchanged and un-cloned, so a caller can write only when
// `result !== input` and preserve the "bail before touching the file" behavior
// byte-for-byte. Every other function always returns a fresh clone.

import { emptyAggregate, foldSession, foldSessions } from "@/lib/aggregate";
import type { FactId, HistoryFile, QuizSessionRecord } from "@/types";

/**
 * The day-one shell a fresh install starts with, `{ sessions: [], facts: {} }`.
 *
 * Deliberately WITHOUT `claims`/`seen` keys rather than with empty ones: this
 * is what resetAll writes, and its on-disk shape has to match a never-touched
 * install byte-for-byte (see history.test.ts, which pins the exact bytes). The
 * readers all tolerate the two keys being absent — that is what the `?? {}`s and
 * the `??=`s below are for.
 */
export function emptyHistory(): HistoryFile {
  return { sessions: [], facts: {} };
}

/**
 * Record "I know these" for a set of facts, at `ts`.
 *
 * Re-claiming an already-claimed fact MOVES its timestamp forward, which is the
 * intended reading: you are saying it again, today. Idempotent in effect and
 * not in time — see saveClaims in history.ts for the full why.
 */
export function applyClaims(
  hist: HistoryFile,
  facts: FactId[],
  ts: number,
): HistoryFile {
  const next = structuredClone(hist);
  next.claims ??= {};
  for (const f of facts) next.claims[f] = ts;
  return next;
}

/**
 * Withdraw claims — "actually, I don't". Deletes the record rather than writing
 * a zero, so an absent key keeps meaning "never claimed". Always returns a
 * clone, even when nothing was present to delete: history.ts's dropClaims always
 * writes, so matching that keeps the two paths identical.
 */
export function applyDropClaims(hist: HistoryFile, facts: FactId[]): HistoryFile {
  const next = structuredClone(hist);
  if (next.claims) for (const f of facts) delete next.claims[f];
  return next;
}

/**
 * Record "quiz me" for a set of facts, at `ts`. The twin of applyClaims — same
 * timestamp-forward re-recording, different key, because the model reads the two
 * intents apart (see saveSeen in history.ts and claims.seenState).
 */
export function applySeen(
  hist: HistoryFile,
  facts: FactId[],
  ts: number,
): HistoryFile {
  const next = structuredClone(hist);
  next.seen ??= {};
  for (const f of facts) next.seen[f] = ts;
  return next;
}

/**
 * Append a session and fold its per-fact stats into the aggregate.
 *
 * IDEMPOTENT ON `id`: a record whose id is already stored returns the input
 * UNCHANGED and un-cloned (the no-op contract above), so a lost-response retry
 * cannot double every count in it. Records with no id are never deduplicated —
 * without one there is nothing to be sure about. See saveSession in history.ts.
 *
 * The fold is INCREMENTAL onto the stored aggregate and only sound because a new
 * session is the newest one there is (the fold is order-dependent — see
 * aggregate.ts). The `slice(-200)` drops the oldest sessions past the cap while
 * the aggregate keeps what they taught it.
 */
export function applySession(
  hist: HistoryFile,
  session: QuizSessionRecord,
): HistoryFile {
  if (session.id && hist.sessions.some((s) => s.id === session.id)) {
    return hist;
  }
  const next = structuredClone(hist);
  next.sessions.push(session);
  next.sessions = next.sessions.slice(-200);
  for (const [f, s] of Object.entries(session.facts ?? {})) {
    const key = f as keyof typeof next.facts;
    foldSession((next.facts[key] ??= emptyAggregate()), s, session.ts);
  }
  return next;
}

/**
 * Remove sessions (by stable id, else ts) or everything, then rebuild the
 * per-fact aggregate from what survives.
 *
 * A delete that selects NOTHING returns the input UNCHANGED and un-cloned (the
 * no-op contract above). This is not tidiness: hist.facts is grown incrementally
 * by applySession and legitimately carries contributions from sessions the
 * 200-cap has already evicted from hist.sessions, so an unconditional rebuild on
 * an empty request would silently shrink the durable aggregate for a request
 * that asked to delete nothing. See deleteSessions in history.ts.
 */
export function applyDeleteSessions(
  hist: HistoryFile,
  ids: (number | string)[] | null,
  deleteAll: boolean,
): HistoryFile {
  if (!deleteAll && (!ids || ids.length === 0)) return hist;
  const next = structuredClone(hist);
  if (deleteAll) {
    next.sessions = [];
  } else {
    // Key on the STABLE identity, not the wall clock: two records made in the
    // same millisecond share a `ts`, so keying on `ts` would delete both when
    // the user asked to drop one. `id` is that identity; id-less legacy records
    // fall back to `ts`, which matches how they were selected.
    const drop = new Set(ids);
    next.sessions = next.sessions.filter((s) => !drop.has(s.id ?? s.ts));
  }
  next.facts = foldSessions(next.sessions);
  return next;
}

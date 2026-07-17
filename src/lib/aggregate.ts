// Sessions → per-fact aggregates. The ONE fold, and the one definition of what
// counts as evidence.
//
// This existed twice. history.deleteSessions() rebuilt the aggregate
// server-side and summary.historyBefore() rebuilt it client-side, each with its
// own copy of the same five `+=` lines, and the second one's comment said so
// out loud ("the same fold history.deleteSessions() does server-side"). Two
// copies of a commutative sum is a smell you can live with. Two copies of THIS
// is not, for a reason that is new here:
//
//   THE FOLD IS NOW ORDER-DEPENDENT. Addition does not care what order the
//   sessions arrive in. scoring.review() cares about nothing else — it reads
//   the state the previous session left and the time since, so replaying the
//   same sessions shuffled gives a different, silently wrong stability. A
//   duplicate of an order-dependent fold is a bug with a timer on it.
//
// So it lives here, in a module with no `server-only` and no React, and both
// callers get the same answer by construction rather than by both being
// maintained.
//
// WHAT COUNTS AS ONE PIECE OF EVIDENCE
// ====================================
// One SESSION is one test occasion for a fact, and produces exactly one
// review() — not one per showing.
//
// A session can show the same fact several times (a miss requeues it 3–7 cards
// later), and folding one review per showing would be wrong twice over: the
// showings all share the session's single timestamp, so the model would see a
// pile of zero-elapsed evidence and — for misses, which are the whole reason a
// fact gets shown twice — compound the penalty for what is really one failure
// observed once and then re-observed under massed conditions. The requeue is
// the app teaching you; it is not three independent tests.
//
// `hit` is therefore the session's first-try verdict, which the app already
// records and already treats as the strict numerator: quiz-session.finishQuiz
// writes `firstTry` as 0 or 1 PER SESSION (`stats[c].firstTryCorrect === true ?
// 1 : 0`). So the model's notion of a hit is exactly the app's notion of "you
// nailed it", and there is not a second, private definition of correctness in
// here to drift from the one on screen.
//
// Massed repetition across two SESSIONS is a real case and is left to the
// arithmetic: finish a drill, press "Redrill the misses", answer thirty seconds
// later, and the second session folds at p ≈ 1 → ×1.0. See scoring.review().

import { EMPTY_COUNTS } from "@/lib/accuracy";
import { review, UNMET } from "@/lib/scoring";
import type {
  FactAggregate,
  FactCounts,
  FactId,
  QuizSessionRecord,
} from "@/types";

/** A fact with no evidence: nothing done, nothing believed. */
export function emptyAggregate(): FactAggregate {
  return { ...EMPTY_COUNTS, ...UNMET };
}

/** Add one session's counts for one fact. Counts only — commutative, and it
 * genuinely does not care when the session happened. */
function addCounts(agg: FactCounts, s: Partial<FactCounts>): void {
  agg.seen += s.seen ?? 0;
  agg.missed += s.missed ?? 0;
  agg.slow += s.slow ?? 0;
  agg.firstTry += s.firstTry ?? 0;
  agg.correct += s.correct ?? 0;
}

/**
 * Fold one session's record for one fact into `agg`: its counts, and the one
 * review the session is worth.
 *
 * `ts` is the SESSION's timestamp, never `Date.now()`. That is what makes the
 * fold replayable: rebuilding from stored sessions after a delete has to land
 * on the same state the incremental folds did, and it only can if the clock
 * comes from the data. It is also why a session can be folded months later —
 * from a file, on a different machine — and still mean what it meant.
 */
export function foldSession(
  agg: FactAggregate,
  s: Partial<FactCounts>,
  ts: number,
): void {
  addCounts(agg, s);
  // No showings = the fact was in the record but never actually asked. Not a
  // test occasion, so not evidence, so the model's clock must not move: writing
  // lastTested here would tell the model you were tested when you weren't.
  if (!(s.seen ?? 0)) return;
  const next = review(agg, (s.firstTry ?? 0) > 0, ts);
  agg.stability = next.stability;
  agg.lastTested = next.lastTested;
}

/**
 * Rebuild every fact's aggregate from a set of sessions.
 *
 * SORTS BY TIMESTAMP FIRST, and that is not defensive tidiness — it is the
 * correctness condition. Sessions are appended in time order today, so the sort
 * is a no-op today; the day something reorders them (a merge of two machines'
 * history, an import, a `sessions.filter` that keeps insertion order it never
 * promised) an unsorted replay produces stabilities that are wrong and look
 * fine. Cheap here, invisible later.
 */
export function foldSessions(
  sessions: readonly QuizSessionRecord[],
): Record<FactId, FactAggregate> {
  const facts: Record<FactId, FactAggregate> = {};
  for (const session of [...sessions].sort((a, b) => a.ts - b.ts)) {
    for (const [key, s] of Object.entries(session.facts ?? {})) {
      const f = key as FactId;
      foldSession((facts[f] ??= emptyAggregate()), s, session.ts);
    }
  }
  return facts;
}

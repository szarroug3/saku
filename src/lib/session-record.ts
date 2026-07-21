// SessionStats → the durable record. The projection, and nothing else.
//
// WHY THIS IS ITS OWN FILE
// ========================
// This used to be the body of `writeRecord` inside quiz-session.tsx, a `.tsx`
// the test runner cannot load. So the one function that decides what a
// learner's work looks like on disk — including the `firstTry`/`firstTryHit`
// split that had just been got wrong once and fixed — was the one function no
// test could reach. It is pure, it needs no React and no fact registry, and it
// is now testable from a plain `.ts`.
//
// THE UNIT OF A RECORD IS ONE ROUND
// =================================
// A session used to produce exactly one record, written at the very end, from
// `totalStats`. Everything before that moment existed only in localStorage, so
// a session you never finished left NOTHING on disk — eighteen correct answers
// and a 33-byte history.json. Rounds are now committed as they close, one
// record each, which is why the pieces below have to be disjoint:
//
//   totalStats === mergeStats(round 1, round 2, …)
//
// and each round's stats are handed here exactly once, when `closeRound` banks
// them. So the durable counts of a session committed round-by-round equal the
// durable counts of the same session written in one go, by construction rather
// than by arithmetic — there is no subtraction anywhere, and nothing can be
// counted twice because nothing is offered twice. src/lib/session-record.test.ts
// plays that out.
//
// It also means each record's `firstTryHit` is the ROUND's cold verdict, taken
// from the round's own `firstTryCorrect`, which is the honest reading: round 3
// really is a separate test occasion from round 1, minutes of rest apart, and
// the model is entitled to hear about both.

// Both from the DATA-FREE modules rather than the barrels, for the same bundle
// reason quiz-session.tsx imports them that way: this sits on the path of the
// always-mounted provider, and `facts.ts` is the whole ~3.6 MB subject registry.
import { computeResults } from "@/lib/engine/results";
import { firstTryShowings } from "@/lib/first-try";
import type {
  FactId,
  QuizMode,
  QuizSessionRecord,
  SessionStats,
} from "@/types";

/**
 * A fresh identity for a record.
 *
 * Exists so a record can be POSTed more than once safely — see
 * QuizSessionRecord.id and history.saveSession. Minted WITH the record and
 * carried through every retry; a retry that re-minted would defeat the whole
 * mechanism.
 */
export function newRecordId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export interface RecordOptions {
  mode: QuizMode;
  redrill: boolean;
  /** When this piece of work happened. Passed in rather than read here so the
   * function is pure and the tests are not a clock. */
  ts: number;
  /** The record's identity; defaults to a fresh one. */
  id?: string;
  /** The set this ran over — see QuizSessionRecord.planned. */
  planned?: FactId[];
  /** Which round of the loop this is, or how many a one-shot session ran. */
  rounds?: number;
}

/**
 * Project one run's stats into the record that goes on disk.
 *
 * Returns null when nothing was answered. An empty record is not a smaller
 * record, it is a lie: `foldSession` would move `lastTested` for facts nobody
 * was asked, and the sessions list would grow rows for rounds that never
 * happened. A round you walked into and out of without answering has produced
 * no evidence, so it produces no record.
 */
export function buildSessionRecord(
  stats: SessionStats,
  opts: RecordOptions,
): QuizSessionRecord | null {
  const s = computeResults(stats);
  if (!s.total) return null;
  const facts: QuizSessionRecord["facts"] = {};
  for (const c of s.facts) {
    facts[c] = {
      seen: stats[c].seen,
      missed: stats[c].misses,
      slow: stats[c].slow,
      // Folded into the aggregate so strict accuracy survives without having to
      // re-read every session's detail. A COUNT of showings, in `seen`'s unit —
      // the durable number and the pill the learner just watched are then the
      // same measurement rather than two.
      firstTry: firstTryShowings(stats[c]),
      // The scheduler's hit, written separately and read only by
      // aggregate.foldSession. One verdict per record, from the flag the results
      // boards use; see SessionFactCounts.firstTryHit for why it is not
      // `firstTry > 0`.
      firstTryHit: stats[c].firstTryCorrect === true,
      // Showings that ended right — the forgiving numerator. A showing nobody
      // answered contributes 0, which is the point: it is not a pass.
      //
      // TEMPORARY BRIDGE: grid and pairs don't increment detail.correct yet, so
      // a landed fact arrives here as correct: 0. Fall back to everCorrect,
      // which collapses a run to at most one correct showing — coarse, but it
      // never calls an unanswered fact right.
      //
      // `||`, NOT `??`: newFactStat initialises correct to 0, so the nullish
      // operator would never fire and every grid/pairs fact would score 0%
      // forgiving. The only case `||` gets wrong is a real 0 with everCorrect
      // true, which can't happen — landing a card increments both. Delete this
      // once both screens keep the counter.
      correct: stats[c].correct || (stats[c].everCorrect ? 1 : 0),
    };
  }
  return {
    id: opts.id ?? newRecordId(),
    ts: opts.ts,
    mode: opts.mode,
    redrill: opts.redrill,
    total: s.total,
    forgivingPct: Math.round((100 * s.forg) / s.total),
    strictPct: Math.round((100 * s.strict) / s.total),
    facts,
    detail: stats,
    ...(opts.planned ? { planned: opts.planned } : {}),
    ...(opts.rounds !== undefined ? { rounds: opts.rounds } : {}),
  };
}

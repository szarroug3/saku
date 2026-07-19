// The session loop, as data. No React, no clock, no storage — every function
// here is pure so the loop can be reasoned about (and tested) without mounting
// anything.
//
// THE LOOP
// ========
// You do the first round. At the end you can retry the misses, or pick your
// own subset — either way you come back to the same end-of-round screen. When
// you hit COMPLETE ROUND a rest starts. When it ends you run THE SAME WHOLE
// SESSION again — not just the bits you retried — and it repeats until you say
// you're done.
//
//   drilling ──finish──▶ round-complete ──retry──▶ drilling ──finish──┐
//                              │        ◀───────────────────────────── ┘
//                              │ complete round
//                              ▼
//                          resting ──start round──▶ drilling  (round + 1)
//                              │
//                              │ done for now
//                              ▼
//                           complete
//
// TWO NUMBERS, NOT A DOUBLING RULE
// ================================
// The first rest is 5 minutes and every rest after it is 10. Those are two
// plain settings the user types, NOT `first × 2` and not a curve. The user was
// explicit: they do not want to configure an algorithm, they want to type 5
// and 10. `restMinutes` below is the whole rule and it is four lines.
//
// THE REST IS A TIMESTAMP, NOT A PROCESS
// ======================================
// `restUntil` is an absolute ms timestamp written once when the round
// completes. Nothing runs. Close the tab, come back tomorrow, and the rest is
// simply over — the same read of the same number gives the same answer. A rest
// timer that broke when you closed the tab would be a bug; this one cannot
// have that bug, because there is nothing alive to break. Leaving during a
// rest is free: nothing is in flight.

// From the data-free module, not facts.ts: session.ts is on the always-mounted
// QuizSessionProvider's import path, and factKeys needs no fact registry.
import { factKeys } from "@/lib/fact-keys";
import type { FactId, FactSessionDetail, SessionStats } from "@/types";

import type { QuizSnapshot } from "@/lib/quiz-session-types";

export type SessionPhase =
  /** Round 1 only, and only when the budget put new material in the session:
   * the items you haven't met (or have comprehensively lost) are SHOWN, with
   * their answers, before anything is asked. See src/lib/budget.ts. */
  | "teaching"
  /** A round (or a retry leg of one) is on screen. */
  | "drilling"
  /** The fork: retry misses, pick your own, or complete the round. */
  | "round-complete"
  /** The rest. A countdown and nothing else. */
  | "resting"
  /** Finished for good — the screen that says what you did. */
  | "complete";

/** What one finished round looked like. Summary only: this is what the
 * session-complete screen compares ("18 first try, up from 14"), so it holds
 * counts and never content. */
export interface RoundSummary {
  round: number;
  /** Facts asked in the round. */
  total: number;
  /** Facts landed on the first attempt of the round. */
  firstTry: number;
  /** Facts missed at least once during the round. */
  missed: number;
}

export interface StudySession {
  /** The whole set, frozen at start. EVERY round re-runs exactly this — the
   * retry legs narrow the leg, never the session.
   *
   * This is what the BUDGET decided (src/lib/budget.ts): the ranked material
   * plus enough teach material to reach the length you asked for. It is not
   * simply "what you selected" — the selection is the pool the budget drew
   * from.
   *
   * FACTS, not characters. The budget always spoke facts; this field used to
   * take `string[]`, and because FactId is a branded string a FactId[] slid
   * into it with no complaint and no conversion — which is exactly how the
   * app came to have a session type that LOOKED char-keyed while carrying
   * facts. See src/lib/quiz-session.tsx. */
  facts: FactId[];
  /**
   * The subset of `facts` that was taught rather than asked cold — new to you,
   * or lost badly enough that the model can't tell the difference.
   *
   * Kept for the life of the session, not just the teaching phase, because the
   * session-complete screen's comparison is only honest if it knows which
   * items you had never seen when round 1 started.
   */
  teach: FactId[];
  /** What this session is, in words — frozen at start, same rule and same
   * reason as ActiveQuiz.what: the selection is a query over history, and
   * history moves the moment you answer anything. */
  what: string;
  /** Builder settings frozen at start, same rule as a one-off quiz. */
  snapshot: QuizSnapshot;
  startedAt: number;
  /** The round being drilled, or the one just finished. 1-based. */
  round: number;
  phase: SessionPhase;
  /** When the rest ends, ms since epoch. Null unless `phase === "resting"`.
   * A stored number, never a running timer — see the header. */
  restUntil: number | null;
  /** The current round's stats, merged across its retry legs. */
  roundStats: SessionStats;
  /** Every round so far. */
  rounds: RoundSummary[];
  /** Every round's stats merged — what gets written to history at the end. */
  totalStats: SessionStats;
  /** Last time an answer landed. Drives Home's Continue/Restart emphasis. */
  lastActiveAt: number;
}

/** The fixed number of quizzes in one session run. */
export const SESSION_ROUND_TARGET = 3;

/**
 * How long the rest before `nextRound` is, in minutes.
 *
 * Two settings, read straight through. The first rest (the one before round 2)
 * is `firstMin`; every rest after it is `thenMin`. There is no third case and
 * no arithmetic — that is the entire design and it is why this takes two
 * numbers instead of a growth factor.
 */
export function restMinutes(
  nextRound: number,
  firstMin: number,
  thenMin: number,
): number {
  return nextRound <= 2 ? firstMin : thenMin;
}

/** Milliseconds left in the rest — 0 once it's over. Pure: the caller reads
 * the clock and passes it, so the same `now` gives the same answer forever. */
export function restLeftMs(session: StudySession, now: number): number {
  if (session.restUntil === null) return 0;
  return Math.max(0, session.restUntil - now);
}

/** Is the rest over (or was there never one)? */
export function restIsOver(session: StudySession, now: number): boolean {
  return restLeftMs(session, now) === 0;
}

/** "3:18" — the only thing the rest screen says. */
export function formatCountdown(ms: number): string {
  const total = Math.ceil(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

/** "3:47 PM" — the wall-clock time the rest ends, in the browser's timezone. */
export function formatReturnTime(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });
}

// ---------- stats merging ----------

function emptyStat(): FactSessionDetail {
  return {
    seen: 0,
    misses: 0,
    everCorrect: false,
    firstTryCorrect: null,
    correct: 0,
    slow: 0,
    confused: {},
  };
}

/**
 * Fold `from` into `into`, returning a new SessionStats.
 *
 * The one rule worth stating: `firstTryCorrect` is NEVER overwritten once set.
 * It is a question about the FIRST time you were asked, and a retry leg (or a
 * later round) is by definition not that. Merging it the other way would let
 * round three quietly rewrite how you did cold in round one, which is the one
 * number in the app that has to stay honest.
 *
 * Everything else sums, because everything else is a count of events and the
 * events all really happened.
 */
export function mergeStats(into: SessionStats, from: SessionStats): SessionStats {
  const out: SessionStats = {};
  for (const f of factKeys(into)) out[f] = { ...into[f], confused: { ...into[f].confused } };
  for (const f of factKeys(from)) {
    const src = from[f];
    const dst = out[f] ?? (out[f] = emptyStat());
    dst.seen += src.seen;
    dst.misses += src.misses;
    dst.correct += src.correct;
    dst.slow += src.slow;
    dst.everCorrect = dst.everCorrect || src.everCorrect;
    // First time asked wins, forever. See above.
    if (dst.firstTryCorrect === null) dst.firstTryCorrect = src.firstTryCorrect;
    for (const e of Object.keys(src.confused)) {
      const key = e as keyof typeof src.confused;
      dst.confused[key] = (dst.confused[key] ?? 0) + src.confused[key];
    }
  }
  return out;
}

/** Facts missed at least once, or never landed — what "Retry the misses"
 * re-asks. Ordered most-missed first. */
export function missedInRound(stats: SessionStats): FactId[] {
  return factKeys(stats)
    .filter((f) => stats[f].misses > 0 || !stats[f].everCorrect)
    .sort((a, b) => stats[b].misses - stats[a].misses);
}

// heldAtRoundEnd() WAS HERE. It listed the facts you walked away holding, to
// feed the round-complete stability floor. Both are gone: the floor is already
// applied, unconditionally, inside scoring.review() — see the long note on
// `closeRound` in quiz-session.tsx. The loop writes no scoring state, so it
// needs no population to write it for.

/**
 * What the round-complete screen shows — deliberately fed from TWO sources,
 * and the whole point of this function is to keep them from being confused.
 *
 * - `selection` is the FULL drill: `session.facts`, frozen at session start and
 *   never shrunk to what you reached. It is what "Pick what to retry" offers,
 *   so ending a round early (answered 1 of 9) still lets you pick any of the 9.
 *   See the field doc on `StudySession.facts`: retry legs narrow the leg, never
 *   the session, so this is the full selection in every leg.
 *
 * - `answered`, `total`, and `firstTry` describe the round you actually PLAYED:
 *   the facts in `roundStats`. The header counts these because they are honest
 *   about what happened — the items you never reached were not "missed," and
 *   inflating the header to the full selection would claim a round you didn't
 *   run.
 *
 * `missed` is the misses of the answered round (`missedInRound`), unchanged —
 * that is what "Retry the misses" re-asks.
 */
export function roundCompleteView(session: StudySession): {
  selection: FactId[];
  answered: FactId[];
  missed: FactId[];
  total: number;
  firstTry: number;
} {
  const stats = session.roundStats;
  const answered = factKeys(stats);
  return {
    selection: session.facts,
    answered,
    missed: missedInRound(stats),
    total: answered.length,
    firstTry: answered.filter((f) => stats[f].firstTryCorrect === true).length,
  };
}

/** Summarise the round that just ended. */
export function summariseRound(round: number, stats: SessionStats): RoundSummary {
  const facts = factKeys(stats);
  return {
    round,
    total: facts.length,
    firstTry: facts.filter((f) => stats[f].firstTryCorrect === true).length,
    missed: facts.filter((f) => stats[f].misses > 0).length,
  };
}

// ---------- coming back ----------

/**
 * One day, in ms — BORROWED, not invented. It is the same day
 * `SCORING.floorDays` uses, which is the only day the model has an opinion
 * about. A session left overnight is one the model would already have decided
 * needs another look.
 *
 * This is why the Restart/Continue emphasis earns no setting: both of its
 * thresholds already exist somewhere else in the app. A third number the user
 * has to think about would be a worse app, not a more configurable one.
 */
export const COLD_AFTER_MS = 24 * 60 * 60 * 1000;

/**
 * Has the session gone cold? Drives WHICH of Home's two buttons is emphasised
 * — never whether they exist. Both are always there and neither ever moves;
 * only the emphasis swaps, once, and a sentence says why.
 */
export function isCold(session: StudySession, now: number): boolean {
  return now - session.lastActiveAt >= COLD_AFTER_MS;
}

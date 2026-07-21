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
// Also from a data-free module, and for the same bundle reason as factKeys.
import { firstTryShowings } from "@/lib/first-try";
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
  /**
   * Facts this round MISSED and then got back on a later leg.
   *
   * The round's stats cannot answer this on their own. `roundStats` is a merge
   * across the legs, and the merge is deliberately lossy about WHEN: a fact you
   * missed cold and then nailed on the retry looks, afterwards, exactly like a
   * fact you missed cold and never re-asked (`misses > 0`, `everCorrect`,
   * `firstTryCorrect: false`). That is the whole of finding 1 — the retry left
   * no trace because there was nowhere for the trace to live.
   *
   * So the leg boundary writes it down, once, in `recoveredAfterLeg`. Optional
   * because a session snapshotted before this field existed comes back without
   * it; read it as `?? []`, which is what a resumed session honestly knows.
   *
   * Reset at every round start, alongside `roundStats`, for the same reason:
   * "you got it back" is a claim about THIS round's misses, and a stale entry
   * would suppress a retry offer you had not yet earned.
   */
  recovered?: FactId[];
  /** Every round so far. */
  rounds: RoundSummary[];
  /** Every round's stats merged — what gets written to history at the end. */
  totalStats: SessionStats;
  /** Last time an answer landed. Drives Home's Continue/Restart emphasis. */
  lastActiveAt: number;
  /** Where this session was started, so a resume surface can decide whether to
   * offer it. A curriculum lesson ("lesson", the default) is resumed from its
   * own Home card and MUST NOT double up on Practice; a Library "Teach me"
   * session ("library") has no card of its own, so Practice resumes it. Absent
   * on sessions snapshotted before this field existed — read those as "lesson",
   * which is what every session was until the Library grew a one-off Quiz. */
  origin?: SessionOrigin;
}

/** Who opened a session. See StudySession.origin. */
export type SessionOrigin = "lesson" | "library";

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
    firstTryCount: 0,
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
 * events all really happened. `firstTryCount` is one of those: it is the FLAG's
 * countable twin — first-try-correct SHOWINGS — and it sums precisely because
 * it is not asking the flag's question. The two are merged by different rules
 * on purpose, and that pair is what src/lib/session.test.ts pins.
 */
export function mergeStats(into: SessionStats, from: SessionStats): SessionStats {
  const out: SessionStats = {};
  for (const f of factKeys(into)) {
    out[f] = {
      ...into[f],
      // Normalised on the way in, not defaulted at every `+=`: a stat restored
      // from a pre-`firstTryCount` snapshot has no such field, and
      // `undefined + n` is NaN — which would spread from here into the live
      // pill and every merge after it. See firstTryShowings().
      firstTryCount: firstTryShowings(into[f]),
      confused: { ...into[f].confused },
    };
  }
  for (const f of factKeys(from)) {
    const src = from[f];
    const dst = out[f] ?? (out[f] = emptyStat());
    dst.seen += src.seen;
    dst.misses += src.misses;
    dst.correct += src.correct;
    dst.firstTryCount += firstTryShowings(src);
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

/**
 * The round's recovered set after one leg finishes: what you had already got
 * back, minus anything this leg put back in doubt, plus what this leg landed
 * clean.
 *
 * Three rules, and the middle one is the reason this is a fold over `prev`
 * rather than a look at the last leg alone:
 *
 *   - a fact this leg ASKED is dropped from `prev` first, so clearing it in
 *     leg 2 and fumbling it again in leg 3 leaves it outstanding. The latest
 *     leg is the one that gets to speak about a fact it asked.
 *   - a fact this leg did NOT ask keeps whatever it earned earlier. Retry two
 *     misses, clear both, then retry only one of them: the other is still back.
 *   - clean means clean: landed with no miss in this leg. Getting there on the
 *     second attempt of the retry is not "you got it back", and pretending
 *     otherwise would take the offer away from the fact that most wants it.
 *
 * Leg 1 needs no special case. It asks everything, so every clean fact enters
 * the set — and none of them are in the round's miss list, which is the only
 * place this set is ever read against.
 */
export function recoveredAfterLeg(
  prev: readonly FactId[],
  legStats: SessionStats,
): FactId[] {
  const asked = factKeys(legStats);
  const askedSet = new Set<FactId>(asked);
  const out = prev.filter((f) => !askedSet.has(f));
  for (const f of asked) {
    const st = legStats[f];
    if (st.misses === 0 && st.everCorrect) out.push(f);
  }
  return out;
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
 * - `answered`, `total`, `firstTry` and `needAnother` describe the round you
 *   actually PLAYED: the facts in `roundStats`. The header counts these because
 *   they are honest about what happened — the items you never reached were not
 *   "missed," and inflating the header to the full selection would claim a
 *   round you didn't run.
 *
 * THE HEADER COUNTS SHOWINGS, AND THAT IS WHY IT ADDS UP
 * ======================================================
 * It used to count FACTS, all three of them, and still printed a line that read
 * as arithmetic: "5 questions · 4 right first try · 2 missed". Six from five.
 * `total` was unique facts, `firstTry` was the per-round FLAG (`firstTryCorrect`
 * — one fact, one vote) and `missed` was `missedInRound`, which counts a fact
 * that was fine cold and fumbled on a later leg. Three different questions, one
 * sentence, no denominator any of them shared.
 *
 * All three are now SHOWINGS, the unit task 03 settled on:
 *
 *     total       = Σ seen              every question the round asked
 *     firstTry    = Σ firstTryShowings  the ones you landed cold, via first-try.ts
 *     needAnother = total - firstTry    by construction, so the line sums
 *
 * `needAnother` is a subtraction and not its own tally on purpose: a third
 * independent count is exactly how the first line stopped adding up. It is also
 * why it is not called "missed" — a hint-assisted answer and a second-attempt
 * answer both land in it, and neither is a miss. It says what it counts.
 *
 * A leg adds showings to the round, so retrying moves these numbers. That is
 * finding 1's fix in its cheapest form: a perfect retry raises `total` and
 * `firstTry` together and the header cannot look identical afterwards.
 *
 * `missed` is the misses of the answered round (`missedInRound`), unchanged and
 * still historical: you did miss these, and a later leg does not get to edit
 * that. `recovered` and `outstanding` split it by what is still TRUE NOW, and
 * `outstanding` is what the picker offers.
 */
export function roundCompleteView(session: StudySession): {
  selection: FactId[];
  answered: FactId[];
  missed: FactId[];
  /** Missed this round, then got back on a later leg. Historical fact kept,
   * actionable offer withdrawn. */
  recovered: FactId[];
  /** Missed this round and not yet got back — what the picker pre-ticks. */
  outstanding: FactId[];
  total: number;
  firstTry: number;
  needAnother: number;
} {
  const stats = session.roundStats;
  const answered = factKeys(stats);
  const missed = missedInRound(stats);
  const back = new Set(session.recovered ?? []);
  const total = answered.reduce((n, f) => n + stats[f].seen, 0);
  const firstTry = answered.reduce((n, f) => n + firstTryShowings(stats[f]), 0);
  return {
    selection: session.facts,
    answered,
    missed,
    recovered: missed.filter((f) => back.has(f)),
    outstanding: missed.filter((f) => !back.has(f)),
    total,
    firstTry,
    needAnother: total - firstTry,
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

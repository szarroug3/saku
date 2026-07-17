// The ranking model — what to ask next, and why.
//
// Pure by contract: no React, no DOM, no fetch, no clock. Every function here
// takes `now` as an argument, so the model has no present tense of its own and
// a test can put it in any week it likes. Its only imports are types, which
// erase — that is what lets scoring.test.ts load it under `node --test` with no
// framework and no build.
//
// WHAT THE TOP OF THE LIST MEANS
// ==============================
// Not "what you are worst at". THE TOP OF THE LIST IS WHAT THE APP LEAST KNOWS
// ABOUT YOU.
//
// That is the whole thesis, and it is the opposite of what this replaced.
// decks.weakestFacts() used to rank by accuracy alone, which fails in two
// directions at once:
//
//   - It cannot see time. A word you have answered right every time, 62 days
//     ago, sits at 100% — and 100% NEVER RISES, so the one thing you have most
//     likely forgotten is the one thing the list structurally cannot surface.
//     Accuracy is a record of the past. It is not a prediction, and a drill
//     list is a prediction or it is nothing.
//   - It ranks certainty first. The thing you fail every single time goes
//     straight to the top, forever — and a question you would certainly fail
//     teaches you nothing that reading the answer wouldn't.
//
// So the sort key is not accuracy and not failure. It is EXPECTED SURPRISE:
// ask the question whose answer the model can least predict. The app never
// DETECTS forgetting — it has no way to. It PROBES for it.
//
// ONE PRINCIPLE, APPLIED THREE TIMES
// ==================================
// Surprise is the only idea in this file. All three of the numbers below are
// the same idea pointed in different directions, and the code says so — they
// are derived from `surpriseIfHit` / `surpriseIfMiss` rather than typed in as
// three unrelated constants that happen to rhyme:
//
//   gain on a hit    ×(1 + (g-1)·(1-p))   how surprised I am that you were right
//   loss on a miss   ×(1 - 0.75·p)        how surprised I am that you were wrong
//   weakness, the sort  4·p·(1-p)         how surprised I EXPECT to be, either way
//
// BOTH TAILS LEAVE THE RANKING
// ============================
// Load-bearing, not a refinement. `weakness` peaks in the middle, so a ranking
// that only sorted would already bury both ends — the tails leave EXPLICITLY,
// with names, because the two ends are not the same event and must not have the
// same consequence:
//
//   p → 1   you know it.          Not ranked. Silence.       ("quiet")
//   middle  the app doesn't know. RANKED. This is the product. ("probe")
//   p → 0   you have LOST it.     Not ranked. It is NEW again. ("teach")
//
// The p → 0 exit is a RESCUE, not an exclusion, and it is the subtle one. Miss
// something three times and its stability floors. Leave it a week and its p
// goes to ~0 — at which point `4·p·(1-p)` also goes to ~0, and the thing you
// are worst at in the entire app sorts to the BOTTOM of the weakness list and
// becomes permanently unaskable. The more you miss it, the deader it gets.
// That is `4·p·(1-p)` eating its own use case, and no threshold on the sort can
// fix it, because the sort is where the bug is.
//
// So a lost fact does not get ranked lower — it leaves the ranking and goes to
// the NEW-MATERIAL budget, to be re-TAUGHT rather than re-tested. Which is
// simply true: you don't know it, and testing someone on what they don't know
// is not teaching. (That budget does not exist yet. `status` is the seam it
// will read; there is deliberately no unused function here waiting for it.)
//
// This is the exact mirror of the cold-start rule — "an unmet fact has no
// strength, so it cannot be weak" — and in this model it is not merely
// analogous to it, it IS it. See UNMET: a fact you have never met and a fact
// you have lost are the same state, and the arithmetic cannot tell them apart
// because there is nothing to tell apart. Neither has any strength. Both need
// teaching. One rule covers both, and there is no cold-start branch anywhere.
//
// THE CONSTANTS ARE PLACEHOLDERS. DEFEND THE SHAPE, NOT THE NUMBERS.
// ==================================================================
// 2.3, 0.75 and the exponential are INVENTED. They are one engineer's guesses,
// fitted to nothing. FSRS is fitted on hundreds of millions of real reviews and
// would beat them outright; it is not here for one reason only — its entire
// output surface is a DUE DATE, and a due date is banned in this app (see
// FactState.stability). That is a disagreement about the product, not about the
// arithmetic, and it does not make these numbers good.
//
// So this rule WILL be replaced, and the module is shaped for its own
// replacement rather than for its own correctness:
//
//   - the model's whole input is (stability, lastTested, now). A different pure
//     function over those three slots in here and nothing else changes.
//   - every number lives in SCORING below, typed, with the reason it is that
//     number rather than the value restated in prose. A TS table and not YAML:
//     TS gives comments AND compile-time validation, with no dependency, no
//     build step, and no second file to drift.
//   - nothing outside this file knows how the list is ordered. Callers ask for
//     `rank`, and the answer is a FactId[].

import type { FactId, FactState } from "@/types";

const DAY_MS = 86_400_000;

/**
 * Every number in the model. See the header: these are placeholders, and the
 * shape is the thing to defend.
 */
export const SCORING = {
  /**
   * The shortest interval at which a retest can carry information, in days —
   * and the floor under every stability.
   *
   * Anything shorter is massed repetition: you saw it minutes ago, so getting
   * it right says nothing about your memory a week from now. The floor is NOT
   * what neutralises massed repetition — the `(1-p)` gate in `review` already
   * does that, by arithmetic, with no same-day branch anywhere. This floor is
   * the separate promise that stability can never decay to zero and take a fact
   * out of the model entirely: at 1 day a floored fact is back in the ranking
   * tomorrow, rather than gone.
   */
  floorDays: 1,

  /**
   * Stability multiplier for a MAXIMALLY surprising hit — one at p → 0, where
   * the model was certain you had lost it and you produced the answer anyway.
   * Every lesser hit is scaled down from here by how unsurprising it was, so
   * this is the ceiling on what one correct answer can ever be worth.
   *
   * 2.3 is invented. It is roughly the ratio between successive intervals in
   * the spacing schedules this app's users would recognise, which is a reason
   * to pick it and not evidence that it is right.
   */
  gain: 2.3,

  /**
   * How much of a stability a MAXIMALLY surprising miss takes — one at p → 1,
   * where the model was certain you knew it. The multiplier is
   * `1 - maxLoss·p`, so the worst case keeps 0.25 of the stability rather than
   * zeroing it: one miss is evidence, not a reset. Being wrong about you is a
   * reason to lower confidence, not to throw the history away.
   */
  maxLoss: 0.75,

  /**
   * Above this recall the fact is QUIET — you know it, so asking teaches the
   * app nothing it doesn't already believe, and asking anyway is how a study
   * app fills a session with the answers you already own.
   */
  quietAbove: 0.9,

  /**
   * At or below this recall the fact is GONE, and goes back to the
   * new-material budget to be taught. See the header — this is the rule that
   * stops the thing you are worst at from becoming unaskable.
   *
   * Symmetric with `quietAbove` today (both sit at weakness 0.36), and that is
   * a coincidence worth keeping but not a constraint: the point at which the
   * app should stop testing you is not obliged to mirror the point at which it
   * should stop teaching you, and these are two knobs so that a future fit can
   * move one without the other.
   */
  teachBelow: 0.1,
} as const;

/**
 * What should happen to a fact — the model's only output besides the order.
 *
 * Named for the ACTION, not for the arithmetic, because the arithmetic is this
 * module's business and the action is the caller's. It also means no call site
 * has a reason to hold a `p`, a `stability` or a `weakness`, which is the
 * cheapest way to keep all three out of the UI.
 */
export type FactStatus =
  /** p → 0. Never met, or lost — the model cannot tell, and needn't. Re-TAUGHT
   * via the new-material budget, never tested. */
  | "teach"
  /** The middle. The app doesn't know. RANKED — this is the product. */
  | "probe"
  /** p → 1. You know it. Silence. */
  | "quiet";

/**
 * A fact the model has no evidence about.
 *
 * `lastTested: 0` is the epoch, so `elapsedDays` is ~20,000 and `recall` is 0 —
 * an unmet fact reads as p → 0 and lands in "teach" by the SAME arithmetic that
 * puts a forgotten fact there. That identity is the design, not a trick: an
 * unmet fact has no strength, a lost fact has no strength, and a model of
 * strength has nothing to say about either. Both need teaching, so both take
 * the same exit, and there is no cold-start case in this file.
 *
 * It follows that a first review runs at p = 0 and so is maximally surprising —
 * a first hit earns the full `gain`, and a first MISS costs exactly nothing
 * (`1 - maxLoss·0` = 1). Which is right, and is the same principle again:
 * failing at something you were never taught is not evidence about your memory.
 */
export const UNMET: FactState = { stability: SCORING.floorDays, lastTested: 0 };

/**
 * The state a stored record implies.
 *
 * Tolerant of a record with no state at all — a history.json written before
 * this model existed, or a fact whose evidence predates it. That reads as
 * UNMET, which is the truthful answer: nothing is known about it. (history.json
 * is disposable test data and owed no migration; this is here so that an old
 * file degrades to "teach everything" instead of to NaN, not as a compatibility
 * promise.)
 */
export function stateOf(stored: Partial<FactState> | undefined): FactState {
  const stability = stored?.stability;
  return {
    stability:
      typeof stability === "number" && stability > 0
        ? Math.max(SCORING.floorDays, stability)
        : SCORING.floorDays,
    lastTested: stored?.lastTested ?? 0,
  };
}

/** Days since this fact was last tested. Never negative: a session timestamped
 * before the last one it folded is clock skew, not time travel, and reads as
 * "just now" rather than as negative elapsed time (which would put p above 1
 * and make `weakness` negative). */
export function elapsedDays(state: FactState, now: number): number {
  return Math.max(0, (now - state.lastTested) / DAY_MS);
}

/**
 * Predicted probability you would recall this right now — the model's whole
 * belief, as one number in [0, 1].
 *
 * Exponential decay: p = exp(-elapsed / stability), so `stability` days after
 * the last test the prediction is 1/e ≈ 37%. The exponential is an assumption
 * (memory is probably better described by a power law, and every serious fit
 * says so) and it is INTERNAL — swap it and every consumer below is unchanged,
 * because they all consume `p`, never the curve.
 */
export function recall(state: FactState, now: number): number {
  const stability = Math.max(SCORING.floorDays, state.stability);
  return Math.exp(-elapsedDays(state, now) / stability);
}

/** How surprising a HIT would be at recall `p`. You were expected to succeed
 * with probability p, so succeeding carries 1-p of news. */
function surpriseIfHit(p: number): number {
  return 1 - p;
}

/** How surprising a MISS would be at recall `p`. The mirror: you were expected
 * to fail with probability 1-p, so failing carries p of news. */
function surpriseIfMiss(p: number): number {
  return p;
}

/**
 * How surprised the model expects to be by asking — THE SORT KEY. Peaks at
 * p = 0.5; zero at both ends.
 *
 * The expectation over the two things that can happen, each weighted by how
 * likely it is and how much it would teach:
 *
 *   p·surpriseIfHit(p) + (1-p)·surpriseIfMiss(p)  =  2·p·(1-p)
 *
 * scaled by 2 so that its peak is exactly 1 and the number is readable. That is
 * 4·p·(1-p) — DERIVED here from the same two functions `review` uses, rather
 * than typed in as a formula that merely resembles them. It is called
 * "weakness" because that is what the list it sorts is called; what it measures
 * is the app's ignorance of you, not yours of the material.
 *
 * Symmetric, which is worth saying out loud: p = 0.3 and p = 0.7 score the
 * same. The model is exactly as interested in a question you will probably fail
 * as in one you will probably pass, because it learns the same amount either
 * way. `rank` breaks that tie toward the one you are likelier to fail — but
 * that is a tie-break, and not this function's opinion.
 */
export function weakness(p: number): number {
  return 2 * (p * surpriseIfHit(p) + (1 - p) * surpriseIfMiss(p));
}

/** What to do with a fact at recall `p` — the tails, made explicit. */
export function statusAt(p: number): FactStatus {
  if (p <= SCORING.teachBelow) return "teach";
  if (p >= SCORING.quietAbove) return "quiet";
  return "probe";
}

/** What to do with a fact, as of `now`. */
export function status(state: FactState, now: number): FactStatus {
  return statusAt(recall(state, now));
}

/**
 * The model's ONE write: fold a single piece of evidence into a fact's state.
 *
 * `hit` is one test occasion's verdict — see src/lib/aggregate.ts, which owns
 * what counts as one and supplies `now` from the session's own timestamp rather
 * than from a clock.
 *
 * The multiplier is `surprise`, in both directions:
 *
 *   hit   ×(1 + (gain-1)·surpriseIfHit(p))   — 1.0 at p=1, `gain` at p=0
 *   miss  ×(1 - maxLoss·surpriseIfMiss(p))   — 1.0 at p=0, 1-maxLoss at p=1
 *
 * MASSED REPETITION FALLS OUT OF THIS, WITH NO SPECIAL CASE. Answer the same
 * fact again seconds later — the redrill button on the results screen does
 * exactly this — and elapsed is ~0, so p is ~1, so `surpriseIfHit` is ~0 and
 * the multiplier is exactly 1.0. The stability does not move. There is no
 * same-day branch anywhere in this file, and there must never be one: the
 * arithmetic already says the true thing, which is that answering a question
 * you were asked thirty seconds ago is not evidence about next week.
 *
 * The same p that makes a massed HIT worth nothing makes a massed MISS worth
 * the maximum, and that is not an asymmetry — it is the identical rule read the
 * other way. Getting it right thirty seconds later is what anyone would do;
 * getting it WRONG thirty seconds later is the most informative thing that
 * could possibly have happened.
 */
export function review(state: FactState, hit: boolean, now: number): FactState {
  const p = recall(state, now);
  const factor = hit
    ? 1 + (SCORING.gain - 1) * surpriseIfHit(p)
    : 1 - SCORING.maxLoss * surpriseIfMiss(p);
  return {
    stability: Math.max(SCORING.floorDays, state.stability * factor),
    lastTested: now,
  };
}

/** One fact `rank` may choose from, with everything the model gets to see about
 * it. Deliberately the whole input: an id to hand back, and a state. Not a
 * history, not an accuracy, not a deck. */
export interface RankCandidate {
  readonly id: FactId;
  readonly state: FactState;
}

export interface RankQuery {
  readonly facts: readonly RankCandidate[];
  /** How many to return. Unbounded when absent. */
  readonly limit?: number;
}

/**
 * The drill list: the facts worth asking, best question first.
 *
 * Both tails are gone before the sort — `quiet` and `teach` are not ranked
 * low, they are not ranked. Everything left is something the app genuinely does
 * not know about you, and the order is how much it doesn't know.
 *
 * The result is a FactId[] and nothing else. No score, no p, no stability, no
 * "due in 3 days". A caller gets the ORDER, which is the only part of this
 * model that is honest enough to show a person.
 */
export function rank(query: RankQuery, now: number): FactId[] {
  const scored: Array<{ id: FactId; w: number; p: number }> = [];
  for (const candidate of query.facts) {
    const p = recall(candidate.state, now);
    if (statusAt(p) !== "probe") continue;
    scored.push({ id: candidate.id, w: weakness(p), p });
  }
  scored.sort(
    (a, b) =>
      // Most expected surprise first — the sort this module exists for.
      b.w - a.w ||
      // `weakness` is symmetric about p = 0.5, so genuine ties between a fact
      // you will probably fail and one you will probably pass are routine, not
      // a rounding accident. Break toward the lower p: the model learns the
      // same from either, so the tie is the model's to spend, and it is better
      // spent on the one you are about to get wrong.
      a.p - b.p ||
      // Total order or the list flickers between renders for no reason.
      (a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
  );
  return scored.slice(0, query.limit ?? scored.length).map((s) => s.id);
}

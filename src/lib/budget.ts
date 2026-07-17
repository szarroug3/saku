// How a session gets filled.
//
// Pure: no React, no clock, no storage. `now` is an argument, same contract as
// src/lib/scoring.ts, which this file consumes and does not duplicate. Nothing
// here re-derives a `p`, a weakness or an order — `status()` and `rank()` are
// imported and believed.
//
// THE HOLE THIS FILLS, AND WHY IT IS NOT OPTIONAL
// ==============================================
// The ranking model routes BOTH tails out of the ranking, on purpose:
//
//   p → 1   you know it     → "quiet"  → not ranked. Correct: silence.
//   p → 0   you've lost it  → "teach"  → not ranked. Re-taught, not re-tested.
//
// The p → 0 exit is a RESCUE — it exists so that the thing you are worst at
// can't sort to the bottom of a curve that peaks in the middle and become
// permanently unaskable. But a rescue is only a rescue IF SOMETHING CATCHES
// THEM. Without this file, "leaves the ranking as teach" and "permanently
// unaskable" are the same outcome reached by different roads: on a real
// 27-session history, 22 facts split 5 probe / 5 quiet / 12 teach, and once the
// 5 probe facts were drilled the drill shelf went dark — with さしす, at 0%
// accuracy, in no list anywhere. The bug the p→0 rule was invented to prevent,
// arriving through the door built to escape it.
//
// It is worse than it sounds, because THE PROBE WINDOW IS NARROW: a fact is
// rankable only between roughly 0.1× and 2.3× its stability after it was last
// tested. Come back after a month away and almost everything is "teach" — the
// drill list empties exactly when you most need it. The budget is not a
// cold-start nicety. It is what makes the model shippable on any day but a
// typical Tuesday.
//
// ONE RULE, NO BRANCH
// ===================
//   An unmet fact has no strength, so it cannot be weak.
//   Ranking runs over met facts only. The rest are a BUDGET: fill the session
//   to the length the user asked for.
//
//   Day one     met 0      weak 0     → 100% new
//   Week three  met 180    weak 11    → 11 weak + 9 new
//   Year two    met 6,000  weak 100s  → 20 weak, 0 new
//
// Same rule at all three. Nothing in this file knows which row it is in.
//
// AND THERE IS NO "NEW" BUCKET — THERE IS ONLY "TEACH"
// ===================================================
// The thing that makes this small: UNMET AND LOST ARE THE SAME STATE, not
// analogous ones. `UNMET = {stability: floorDays, lastTested: 0}` gives p = 0
// and lands in "teach" by the IDENTICAL arithmetic that sends a forgotten fact
// there. So the budget does not distinguish "never seen" from "comprehensively
// forgotten" — it draws from `teach` and does not ask. Which of the two a given
// item is, is a PRESENTATION question (see `TaughtItem.familiar`), never a
// scheduling one. There is no cold-start branch here, because there is no cold
// start: day one is just the day when every fact happens to be in `teach`.

import { rank, status, stateOf } from "@/lib/scoring";
import type { FactId, FactState, HistoryFile } from "@/types";

export interface SessionPlan {
  /**
   * Facts to ASK, best question first — straight from `rank`. The order is the
   * model's and this file does not touch it.
   */
  probe: FactId[];
  /**
   * Facts to TEACH: shown with their answer, then drilled.
   *
   * NOT tested cold. Asking someone a question you already predict they will
   * fail teaches nothing that showing them the answer wouldn't, and it is the
   * same reason `weakness` peaks at p = 0.5 rather than at p = 0 — the model is
   * not interested in a foregone conclusion, and neither is the person.
   */
  teach: FactId[];
  /** Whether the pool ran out before the requested length did. The caller may
   * want to say so; nothing here does. */
  short: boolean;
}

/** Every fact in the plan, in the order the session should meet them: taught
 * first, then probed. */
export function planFacts(plan: SessionPlan): FactId[] {
  return [...plan.teach, ...plan.probe];
}

export interface PlanQuery {
  /** The pool — the user's selection, or their whole knowledge base. */
  candidates: readonly FactId[];
  /** What the app knows about each fact. Facts absent from history read as
   * UNMET via `stateOf`, which is the truthful answer and not a special case. */
  history: HistoryFile;
  /**
   * How many facts the user asked for. `null` = unlimited, which means "no cap"
   * and NOT "no budget": an unlimited session is everything that isn't quiet,
   * which on day one is the whole selection and in year two is everything you
   * are shaky on. Same rule, no branch.
   */
  length: number | null;
  now: number;
}

/**
 * Fill a session: rank what's rankable, top up from `teach`.
 *
 * The order of business matters and is the whole algorithm:
 *
 *   1. Split the pool by `status` — the model's call, not ours.
 *   2. `probe` is ranked and takes the session first. It is the product.
 *   3. If that didn't fill the session, `teach` makes up the difference.
 *
 * `quiet` is never drawn from, at any length, even when that leaves the session
 * short. A session padded with the answers you already own is the failure mode
 * the whole model exists to avoid, and "the user asked for 20" is not a good
 * enough reason to hand them 8 real questions and 12 gimmes. `short` says so
 * instead.
 */
export function planSession(query: PlanQuery): SessionPlan {
  const { candidates, history, length, now } = query;

  const probeCandidates: Array<{ id: FactId; state: FactState }> = [];
  const teachable: FactId[] = [];

  for (const id of candidates) {
    const state = stateOf(history.facts[id]);
    switch (status(state, now)) {
      case "probe":
        probeCandidates.push({ id, state });
        break;
      case "teach":
        teachable.push(id);
        break;
      case "quiet":
        // Silence. Not a fallback, not a last resort — see the doc comment.
        break;
    }
  }

  // Unlimited: everything that isn't quiet. Ranked material first, then the
  // rest to be taught.
  if (length === null) {
    return {
      probe: rank({ facts: probeCandidates }, now),
      teach: teachable,
      short: false,
    };
  }

  const probe = rank({ facts: probeCandidates, limit: length }, now);
  // `teachable` is in candidate order, which is the curriculum's order — the
  // sequence the data file already puts kana in (vowels, then K, then S…).
  // Deliberately not shuffled and not ranked: `rank` REFUSES these (they have
  // no strength to rank), and the order new material should arrive in is a
  // property of the material, not of your memory of it.
  const teach = teachable.slice(0, Math.max(0, length - probe.length));

  return {
    probe,
    teach,
    short: probe.length + teach.length < length,
  };
}

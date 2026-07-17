// How a session gets filled.
//
// Pure: no React, no clock, no storage. `now` is an argument, same contract as
// src/lib/scoring.ts, which this file consumes and does not duplicate. Nothing
// here re-derives a `p`, a weakness or an order — `status()` and `rank()` are
// imported and believed.
//
// ONE deliberate non-determinism: the `random` branch (a user-built selection)
// shuffles, same as selection.resolve does, because the owner's rule for that
// screen is a uniform random draw, not a repeatable one. The default (app-chosen)
// plan is fully deterministic given (candidates, history, now).
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
//
// WHERE THAT STOPS BEING TRUE: HOW MUCH NEW MATERIAL, AND IN WHAT UNIT
// ====================================================================
// The paragraph above is about SCHEDULING and it still holds: nothing here asks
// whether a `teach` fact is new or lost in order to decide what to DO with it.
// Both get taught. But the two differ in one respect the arithmetic genuinely
// cannot see, because it is not a fact about your memory at all:
//
//   Lost material is a BACKLOG. It is bounded by what you have already done,
//   it arrived one item at a time, and there is no unit to hand it out in.
//   New material is a CURRICULUM. It is bounded by nothing — the pool is every
//   character the app ships — and it already comes in units, because the
//   material has an order and that order has joints in it.
//
// Ignore the difference and an unlimited day-one session is the entire pool:
// 214 characters on one teach screen, which is not a lesson, it is a table of
// contents. So new material is drawn ONE GROUP AT A TIME and then it STOPS.
// The group is あいうえお, then かきくけこ — the sections `src/data/characters.ts`
// has always had, in the order it has always had them.
//
// LOST MATERIAL IS NOT GROUPED, and that is the part to get right. A group is a
// property of the curriculum, not of you: さ, し and す were introduced together
// and that says nothing whatever about whether you lost them together. Handing
// back "the S row" because you dropped し would re-teach two things you still
// know, and grouping the backlog would put a fact you lost in March behind
// however many groups happen to sort before it. So the lost bucket keeps
// exactly the behaviour it had — every lost fact, in candidate order, taught on
// its own account. Only the new tail is grouped.
//
// The split is `lastTested`, and it is not a new question the model has to
// answer: a fact with no evidence has never been tested, so `lastTested` is 0,
// and that is already how UNMET is spelled. Nothing here re-derives "new".

import { effectiveState } from "@/lib/claims";
import { rank, status } from "@/lib/scoring";
import type { FactId, FactState, HistoryFile } from "@/types";

/** Fisher–Yates in place. Local rather than imported from engine/index: that
 * module pulls the whole question/answer runtime, and the budget is a leaf the
 * page's plan depends on — a dependency the other way would be a cycle. */
function shuffle<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

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
  /** What the app knows about each fact — and what the user has SAID about it.
   * Facts absent from both read as UNMET via `effectiveState`, which is the
   * truthful answer and not a special case. */
  history: HistoryFile;
  /**
   * The curriculum: new material, pre-cut into lessons, in teaching order.
   *
   * Data, not a rule — a group is a property of the material, and this file has
   * no opinion about what belongs in one. `src/lib/lesson.ts` supplies kana's
   * (the sections of `src/data/characters.ts`, which have been in the right
   * order since before there was a budget to read them).
   *
   * Absent = ungrouped, and every fact with no evidence is fair game. That is
   * the old behaviour, kept for a caller with no curriculum to offer rather
   * than for compatibility.
   */
  groups?: readonly (readonly FactId[])[];
  /**
   * How many facts the user asked for. `null` = unlimited, which means "no cap"
   * and NOT "no budget": an unlimited session is everything that isn't quiet,
   * which on day one is the whole selection and in year two is everything you
   * are shaky on. Same rule, no branch.
   */
  length: number | null;
  /**
   * The pool is a USER-BUILT selection — the What-to-drill card, where a person
   * explicitly chose the items — so cap it as a UNIFORM RANDOM subset, not the
   * weakest N.
   *
   * The owner's rule for that screen, said twice: "randomize everything, nothing
   * by rote." When the app is choosing material FOR you (the suggested/study
   * loop, decks.weakestFacts) "your weakest first" is the whole product and
   * stays. When YOU chose the items, re-sorting them hardest-first every time is
   * the rote-drill this avoids: you'd grind your ten worst in the same order and
   * never see the rest of what you picked. So this drops the weakness SELECTION
   * only — quiet is still excluded and the teach/probe roles still stand, they
   * are just sampled uniformly. Default false: an app-chosen plan weakness-ranks.
   */
  random?: boolean;
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
  const { candidates, history, groups, length, now, random = false } = query;

  const probeCandidates: Array<{ id: FactId; state: FactState }> = [];
  // The two tails of `teach`, kept apart for ONE reason: how much of each to
  // draw. See the header — the backlog is bounded and the curriculum isn't.
  const lost: FactId[] = [];
  const fresh = new Set<FactId>();

  for (const id of candidates) {
    const state = effectiveState(history.facts[id], history.claims?.[id]);
    switch (status(state, now)) {
      case "probe":
        probeCandidates.push({ id, state });
        break;
      case "teach":
        // `lastTested: 0` is how UNMET is spelled and the only way to hold it:
        // nothing has ever tested this and nothing has ever claimed it.
        if (state.lastTested > 0) lost.push(id);
        else fresh.add(id);
        break;
      case "quiet":
        // Silence. Not a fallback, not a last resort — see the doc comment.
        break;
    }
  }

  // ONE group of new material, or all of it if the caller has no curriculum.
  const teachable = [...lost, ...lessonFrom(groups, fresh)];

  // USER-BUILT SELECTION: a uniform random N, never the weakest N (see `random`
  // on PlanQuery). The weakness ranking below is skipped entirely — `rank` is
  // not called — so the SELECTION of which items make the cap is a fair shuffle.
  // Quiet is already gone (it never entered probe/teach), and each item keeps
  // its teach-vs-probe role for how the session presents it; only the ORDERING
  // by weakness is dropped, and buildDeck re-shuffles the deck after this anyway.
  if (random) {
    const drillable: Array<{ id: FactId; teach: boolean }> = [
      ...probeCandidates.map((c) => ({ id: c.id, teach: false })),
      ...teachable.map((id) => ({ id, teach: true })),
    ];
    shuffle(drillable);
    const picked = length === null ? drillable : drillable.slice(0, length);
    return {
      probe: picked.filter((x) => !x.teach).map((x) => x.id),
      teach: picked.filter((x) => x.teach).map((x) => x.id),
      short: length !== null && picked.length < length,
    };
  }

  // Unlimited: everything that isn't quiet — except that "unlimited" was never
  // a licence to hand over the whole curriculum at once. It caps the ASKING,
  // and the lesson was already one group before it got here.
  if (length === null) {
    return {
      probe: rank({ facts: probeCandidates }, now),
      teach: teachable,
      short: false,
    };
  }

  const probe = rank({ facts: probeCandidates, limit: length }, now);
  // Both halves of `teachable` are in candidate order, which is the
  // curriculum's order — the sequence the data file already puts kana in
  // (vowels, then K, then S…). Deliberately not shuffled and not ranked: `rank`
  // REFUSES these (they have no strength to rank), and the order new material
  // should arrive in is a property of the material, not of your memory of it.
  //
  // Lost material comes first, so a short session spends itself on the backlog
  // before it starts a lesson. Being handed あいうえお while さしす sits at 0% is
  // the app changing the subject.
  const teach = teachable.slice(0, Math.max(0, length - probe.length));

  return {
    probe,
    teach,
    short: probe.length + teach.length < length,
  };
}

/**
 * The next lesson: the first group with anything new left in it.
 *
 * "First" is the curriculum's order and "anything new" is `fresh` — so a group
 * you have half-claimed yields its remaining half and is not re-taught whole,
 * and a group you have claimed entirely is not a lesson at all. There is no
 * cursor, no "current group" stored anywhere, and nothing to keep in sync: the
 * next lesson is a function of what you know, computed the same way every time
 * anyone asks. Claim all of hiragana and the next lesson is ア, because ア is
 * the first group with anything left in it — not because a pointer moved.
 *
 * Returns the group's fresh facts only, in group order. Empty when the
 * curriculum is done, which is a real state and not an error.
 */
export function nextGroup(
  groups: readonly (readonly FactId[])[],
  fresh: ReadonlySet<FactId>,
): FactId[] {
  for (const group of groups) {
    const left = group.filter((id) => fresh.has(id));
    if (left.length) return left;
  }
  return [];
}

/** New material for one session: one group, or — with no curriculum to cut it
 * with — the lot. */
function lessonFrom(
  groups: readonly (readonly FactId[])[] | undefined,
  fresh: ReadonlySet<FactId>,
): FactId[] {
  return groups ? nextGroup(groups, fresh) : [...fresh];
}

/**
 * Facts the app has no record of whatsoever — never answered, never claimed.
 *
 * The one definition of "new", exported so the screen that ANNOUNCES the next
 * lesson and the budget that RUNS it cannot disagree about what is left. It is
 * `effectiveState(...).lastTested === 0` — the same expression `planSession`
 * splits its teach bucket on, over the same value, so the two are one rule
 * written once and read twice.
 *
 * Note what it does not consult: `now`. Whether you have seen something is not
 * a question about the present, and a fact you lost years ago is not new — it
 * is the thing this file's header is about.
 */
export function freshFacts(
  candidates: readonly FactId[],
  history: HistoryFile,
): Set<FactId> {
  const fresh = new Set<FactId>();
  for (const id of candidates) {
    const state = effectiveState(history.facts[id], history.claims?.[id]);
    if (state.lastTested === 0) fresh.add(id);
  }
  return fresh;
}

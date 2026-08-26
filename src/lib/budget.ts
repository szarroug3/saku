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

// ---------- SAK-192: multi-host recipe pairing ----------
//
// Some facts come in SETS rather than alone — a grammar recipe that attaches
// to more than one host (see src/lib/grammar/host-group.ts's header for the
// full picture) mints a separate FactId per host, and nothing before this
// pointed the scheduler at that relationship. `hostGroupOf` on PlanQuery is
// the opt-in: a caller who knows a subject with this shape passes a function
// mapping a FactId to its group, and this file — which otherwise has no idea
// what a "recipe" or a "host" is — uses it for two things below:
//
//   `pairsKept`     never drop a due sibling the length cap would otherwise
//                   cut, PROVIDED it is already ranked (due) — see the policy
//                   note on `pairsKept` for why this never reaches past what
//                   the SRS already called due.
//   `groupedByPair` cosmetic: once a set is going to be IN the session, sit
//                   its members next to each other rather than wherever the
//                   rank order or the shuffle happened to scatter them.
//
// Neither function has an opinion about WHAT a group is — a `recipeId` is
// just a string two facts happen to share.

export type HostGroupOf = (id: FactId) => { recipeId: string; host: string } | null;

/**
 * THE POLICY: pair only within what the SRS already selected.
 *
 * `ranked` is the full due-and-ranked candidate order (weakest first, no
 * length cap yet — see the two call sites below, which both pass the
 * UNLIMITED `rank()` result). Cutting it to `length` is what can split a
 * pair: one host's fact ranks #3, its sibling ranks #40, and a
 * length-10 session would show one and never the other.
 *
 * This never reaches for a fact `ranked` does not contain. A sibling that
 * is not yet due — `status()` said "teach" or "quiet" for it — never enters
 * `ranked` to begin with, so it can never be "completed" in here. That is
 * the resolved policy question from the ticket: when one host of a recipe is
 * overdue and the other is not yet due, this does NOT inject the not-due one
 * early to force the pair. It only ever REORDERS/COMPLETES a selection the
 * SRS's own due-date logic already assembled — never overrides it. The
 * "only one side due" case in budget.test.ts is this rule's negative case:
 * nothing here can make it fire when there is nothing to complete from.
 *
 * For each recipe with more than one host actually present in `ranked` (a
 * 3-host recipe such as te-sequence completes to three, not two — nothing
 * here is written assuming exactly two), the single BEST-ranked (earliest)
 * fact per host is `required`: if the naive `ranked.slice(0, length)` cap
 * left one out, this swaps it back in, bumping the WORST-ranked fact in the
 * cut that is not itself required by some other pair. When every currently
 * picked fact is required (a small `length` entirely spent on pairs
 * already), a missing sibling is left out rather than growing the session
 * past `length` — the length is the user's, not this rule's, to spend.
 */
export function pairsKept(
  ranked: readonly FactId[],
  length: number,
  hostGroupOf: HostGroupOf,
): FactId[] {
  const picked = ranked.slice(0, length);
  if (picked.length >= ranked.length) return picked; // nothing left to draw from

  // The best (earliest = most due) representative of every (recipe, host)
  // slot present anywhere in the due pool, and which hosts each recipe has
  // due at all.
  const bestOfSlot = new Map<string, FactId>();
  const hostsOfRecipe = new Map<string, Set<string>>();
  for (const id of ranked) {
    const g = hostGroupOf(id);
    if (!g) continue;
    const slot = `${g.recipeId} ${g.host}`;
    if (!bestOfSlot.has(slot)) bestOfSlot.set(slot, id);
    let hosts = hostsOfRecipe.get(g.recipeId);
    if (!hosts) hostsOfRecipe.set(g.recipeId, (hosts = new Set()));
    hosts.add(g.host);
  }

  // A recipe only asks anything of this function once TWO of its hosts are
  // both due — a recipe with just one host due right now has nothing to
  // pair, same as a recipe with no grammar at all.
  const required = new Set<FactId>();
  for (const [recipeId, hosts] of hostsOfRecipe) {
    if (hosts.size < 2) continue;
    for (const host of hosts) {
      required.add(bestOfSlot.get(`${recipeId} ${host}`)!);
    }
  }
  if (!required.size) return picked;

  const pickedSet = new Set(picked);
  const missing = [...required].filter((id) => !pickedSet.has(id));
  if (!missing.length) return picked;

  const result = picked.slice();
  for (const id of missing) {
    let bumpIndex = -1;
    for (let i = result.length - 1; i >= 0; i--) {
      if (!required.has(result[i])) {
        bumpIndex = i;
        break;
      }
    }
    // Every current pick is itself required by some pair — no room to
    // complete this one without growing past `length`. Leave it out.
    if (bumpIndex === -1) break;
    result.splice(bumpIndex, 1, id);
  }
  return result;
}

/**
 * Presentation only: once a set of sibling facts is going into the session
 * (see `pairsKept` for how that gets decided), sit them next to each other
 * instead of wherever rank order or the shuffle scattered them — "draw one
 * example of each host" reads as a pair, not as two unrelated questions
 * sessions apart. Adds and removes nothing; it is a stable regrouping of
 * exactly the ids it was given.
 */
export function groupedByPair(
  ids: readonly FactId[],
  hostGroupOf: HostGroupOf,
): FactId[] {
  const placed = new Set<FactId>();
  const out: FactId[] = [];
  for (const id of ids) {
    if (placed.has(id)) continue;
    out.push(id);
    placed.add(id);
    const g = hostGroupOf(id);
    if (!g) continue;
    for (const other of ids) {
      if (placed.has(other)) continue;
      const og = hostGroupOf(other);
      if (og && og.recipeId === g.recipeId) {
        out.push(other);
        placed.add(other);
      }
    }
  }
  return out;
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
  /**
   * SAK-192: how to find a fact's multi-host GROUP, for subjects that have
   * one — a grammar recipe that attaches to more than one host (verb, an
   * adjective type, …) mints a separate FactId per host, and left alone
   * those siblings are invisible to this file's ranking and to the
   * `random` shuffle: a length cap or an unlucky shuffle can show you one
   * host's fact and never the other, even when both are due. Absent =
   * "this pool has no such grouping", the old behaviour, unchanged.
   *
   * budget.ts does not know or care what a "recipe" or a "host" IS — see
   * src/lib/grammar/host-group.ts, which supplies the grammar-subject
   * instance of this function (`grammarHostGroupOf`) without pulling this
   * file into the grammar data's dependency graph. Two facts sharing a
   * `recipeId` with a DIFFERENT `host` are siblings this file tries to keep
   * together; see `pairsKept`'s doc comment for the exact policy.
   */
  hostGroupOf?: HostGroupOf;
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
    const state = effectiveState(
      history.facts[id],
      history.claims?.[id],
      history.seen?.[id],
    );
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

    let probeIds = picked.filter((x) => !x.teach).map((x) => x.id);
    const teachIds = picked.filter((x) => x.teach).map((x) => x.id);

    // SAK-192: complete a multi-host pair the shuffle split across the cut —
    // PROBE ONLY (see pairsKept's doc comment: a teach-side sibling is not
    // yet due, and this never forces a not-due fact in). There is no rank
    // here — it's a user-built, uniformly-shuffled pool — so `pairsKept`
    // is fed the shuffle's own order as its preference order: already-picked
    // probe ids first, then the rest of the shuffled probe pool it can draw
    // a missing sibling from.
    if (query.hostGroupOf && length !== null) {
      const probeShuffleOrder = drillable
        .filter((x) => !x.teach)
        .map((x) => x.id);
      const pickedProbeSet = new Set(probeIds);
      probeIds = pairsKept(
        [
          ...probeIds,
          ...probeShuffleOrder.filter((id) => !pickedProbeSet.has(id)),
        ],
        probeIds.length,
        query.hostGroupOf,
      );
    }
    if (query.hostGroupOf) probeIds = groupedByPair(probeIds, query.hostGroupOf);

    return {
      probe: probeIds,
      teach: teachIds,
      short: length !== null && picked.length < length,
    };
  }

  // Unlimited: everything that isn't quiet — except that "unlimited" was never
  // a licence to hand over the whole curriculum at once. It caps the ASKING,
  // and the lesson was already one group before it got here.
  if (length === null) {
    const probe = rank({ facts: probeCandidates }, now);
    return {
      probe: query.hostGroupOf ? groupedByPair(probe, query.hostGroupOf) : probe,
      teach: teachable,
      short: false,
    };
  }

  // Unlimited rank order — SAK-192's `pairsKept` does its own length cut
  // below so it can pull a due sibling back in past a naive weakest-N slice;
  // without a grouping function this is exactly `rank(..., limit: length)`
  // (see rank()'s own body: `limit` is nothing but a slice).
  const rankedProbe = rank({ facts: probeCandidates }, now);
  let probe = query.hostGroupOf
    ? pairsKept(rankedProbe, length, query.hostGroupOf)
    : rankedProbe.slice(0, length);
  if (query.hostGroupOf) probe = groupedByPair(probe, query.hostGroupOf);
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
    const state = effectiveState(
      history.facts[id],
      history.claims?.[id],
      history.seen?.[id],
    );
    if (state.lastTested === 0) fresh.add(id);
  }
  return fresh;
}

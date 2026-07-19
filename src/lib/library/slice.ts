// A SLICE — whatever you are currently looking at — and the three things you
// can do with it.
//
// This is the Library's one real abstraction, and it exists because the bar at
// the bottom of every reference screen is the same bar. A shelf, a section, a
// search, a row, one entry: each is a set of entries with a name, and each
// offers drill / claim / file. Writing that three times would be three subtly
// different answers to "what does Drill mean here".
//
// THE DEFAULT IS THE FEATURE
// ==========================
// The bar says "everything here that isn't solid · 9 questions", never "142
// questions". That is not a nicety; it is the difference between a button worth
// pressing and a button that punishes you for browsing. Opening 生 — nine
// readings, five of which you own — and being offered a nine-question drill is
// how an app teaches you not to open 生. The user's whole thesis for the ranked
// drill applies at this scale too: asking what you already know teaches the app
// nothing and costs you the session.
//
// So a slice's drill is NOT its facts. It is its facts minus the ones the model
// is already sure of, in the order the model wants them.

import { effectiveState, type Claims } from "@/lib/claims";
import { factsOf } from "@/lib/facts";
import { rank, status, type RankCandidate } from "@/lib/scoring";
import type { EntryId, FactAggregate, FactId } from "@/types";

/**
 * A named set of entries. Facts are DERIVED (`factsOf`) rather than carried,
 * so a slice cannot be built that contains a fact its entries don't — which is
 * the one way the two key spaces could quietly diverge on this screen.
 */
export interface Slice {
  /** What the bar calls it. "K か", "で", "生", "Hiragana". */
  readonly label: string;
  /** What is in it, in the order the screen showed them. */
  readonly entries: readonly EntryId[];
}

/** Every fact of every entry in the slice, in screen order. */
export function sliceFacts(slice: Slice): FactId[] {
  return slice.entries.flatMap((e) => factsOf(e));
}

/**
 * Is there anything here worth drilling? ONE fact is not a drill.
 *
 * A single kana IS its one reading — か has exactly one fact — so a "drill" of it
 * is a one-question session that teaches nothing the screen above the bar hasn't
 * already shown. The bar hides its Drill button on these, and this is the rule it
 * asks. It gates on TOTAL facts, not on how many are unlearned: a kana has one
 * thing to know whether or not you know it, and "one thing to learn → no drill"
 * is the owner's rule. A kanji (meaning + readings) or a word (reading + meaning)
 * clears it; a single kana, or a subject that resolves to one fact, does not.
 */
export function sliceIsDrillable(slice: Slice): boolean {
  return sliceFacts(slice).length > 1;
}

/**
 * The drill, in order: everything in the slice the model is not already sure
 * of, best question first.
 *
 * Two groups, concatenated, and the split is scoring.ts's own:
 *
 *   probe — RANKED. `rank` is the app's one answer to "what should I ask", and
 *           this is the same call the drill makes, over a smaller pool. The
 *           Library does not have a second opinion about ordering.
 *   teach — NOT RANKED, and appended in screen order. `rank` drops these on
 *           purpose (p → 0 is unaskable and belongs to the new-material budget),
 *           so a slice of untouched kana would rank EMPTY and the bar on the か
 *           row would read "Drill 0" — for five characters you have never seen.
 *           That is the arithmetic eating its own use case, one level up from
 *           where scoring.ts's header describes it.
 *
 * Which is the right answer to a question scoring.ts explicitly left open: it
 * says the new-material budget "does not exist yet. `status` is the seam it will
 * read." On a slice, the budget is the slice — you pointed at these five things
 * and asked for them, so "what new material should this session contain" has an
 * answer that needs no budget policy at all. That is why this is here and not a
 * change to rank().
 *
 * `quiet` never appears. That is the whole default.
 *
 * EXCEPT when you asked for these by name. `includeSolid` is the one seam that
 * bends the default, and only for an EXPLICIT selection: you toggled these five
 * things and pressed Drill, so "don't re-drill what you know" stops being a
 * kindness and starts being the app refusing the thing you literally pointed at.
 * When it is true, a `quiet`/solid fact is not dropped — it is put into `probe`,
 * asked directly (no teach step; you already know it). Whole-shelf and
 * whole-section drills never pass it, so browsing still costs you nothing.
 */
export function drillPlan(
  slice: Slice,
  facts: Record<FactId, FactAggregate>,
  claims: Claims,
  now: number,
  includeSolid = false,
): DrillPlan {
  const probe: RankCandidate[] = [];
  const teach: FactId[] = [];
  // Solid facts an explicit selection asks anyway. Kept apart because `rank`
  // drops them on purpose (a quiet fact scores p → 1 and is unrankable); they
  // are appended after the ranked probes rather than routed through it.
  const solid: FactId[] = [];
  for (const id of sliceFacts(slice)) {
    const state = effectiveState(facts[id], claims[id]);
    switch (status(state, now)) {
      case "probe":
        probe.push({ id, state });
        break;
      case "teach":
        teach.push(id);
        break;
      case "quiet":
        // The default drops this; an explicit selection asks it anyway.
        if (includeSolid) solid.push(id);
        break;
    }
  }
  return { probe: [...rank({ facts: probe }, now), ...solid], teach };
}

/**
 * The two halves, kept apart — because the session loop wants them apart.
 *
 * This is not a convenience over `drillOrder`; it is the shape the app actually
 * consumes. `quiz-session.startSession(chars, teach)` takes new material as its
 * own argument and SHOWS it before asking it, which is the same distinction
 * scoring.ts draws and for the same reason: testing someone on what they have
 * never met is not teaching. The Library computed that split anyway to answer
 * "what would you drill"; handing both halves over means the session gets to be
 * a normal session rather than a flat list the loop has to re-derive.
 */
export interface DrillPlan {
  /** Ranked. The app's one answer to "what should I ask", over a smaller pool. */
  readonly probe: readonly FactId[];
  /** Never met, or lost. Shown before it is asked. */
  readonly teach: readonly FactId[];
}

/** The plan as one list — everything the drill would touch, probe first. For
 * the bar's count and for anything that only needs the size of the thing. */
export function drillOrder(
  slice: Slice,
  facts: Record<FactId, FactAggregate>,
  claims: Claims,
  now: number,
): FactId[] {
  const plan = drillPlan(slice, facts, claims, now);
  return [...plan.probe, ...plan.teach];
}

/** How a slice stands, for the bar's one line of prose. */
export interface SliceCount {
  /** Facts the drill would ask — `drillOrder().length`. The number on the
   * button. */
  readonly drillable: number;
  /** Every fact in the slice. The number the button deliberately ISN'T. */
  readonly total: number;
  /** Facts with any showings behind them. "7 seen, 11 in total". */
  readonly seen: number;
  /** Facts the model is sure of — what `drillable` leaves out, named so the bar
   * can explain itself rather than just be smaller than you expected. */
  readonly solid: number;
}

export function sliceCount(
  slice: Slice,
  facts: Record<FactId, FactAggregate>,
  claims: Claims,
  now: number,
  includeSolid = false,
): SliceCount {
  const all = sliceFacts(slice);
  let seen = 0;
  let solid = 0;
  for (const id of all) {
    if ((facts[id]?.seen ?? 0) > 0) seen++;
    if (status(effectiveState(facts[id], claims[id]), now) === "quiet") solid++;
  }
  // An explicit selection drills its solid facts too, so they are not the
  // number the button "deliberately isn't": drillable is everything, and the
  // bar has no solid remainder to explain away.
  if (includeSolid) return { drillable: all.length, total: all.length, seen, solid: 0 };
  return { drillable: all.length - solid, total: all.length, seen, solid };
}

/**
 * The bar's sentence. One function, so that every surface says it the same way
 * and no screen invents its own phrasing for the same arithmetic.
 *
 * The cases are the ones that actually happen, and each says something true and
 * different:
 *
 *   nothing to drill ... you own the whole slice. Say so; don't offer a button.
 *   nothing seen yet ... "5 questions · not seen yet" — the honest version of a
 *                        drill that is entirely new material.
 *   the mixed case .... "everything here that isn't solid · 9 questions".
 */
export function sliceSentence(c: SliceCount): string {
  if (c.total === 0) return "nothing here to drill";
  if (c.drillable === 0) {
    return `all ${c.total} solid, nothing to ask`;
  }
  if (c.seen === 0) {
    return `${c.drillable} question${c.drillable === 1 ? "" : "s"} · not seen yet`;
  }
  if (c.solid === 0) {
    return `${c.drillable} question${c.drillable === 1 ? "" : "s"}`;
  }
  return `everything here that isn't solid · ${c.drillable} question${
    c.drillable === 1 ? "" : "s"
  }`;
}

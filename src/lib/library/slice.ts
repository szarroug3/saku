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
import { constructionConfigForFact } from "@/data/counter-categories";
import { factsOf } from "@/lib/library/library-index";
import { rank, status, type RankCandidate } from "@/lib/scoring";
import { transitivitySide } from "@/data/transitivity-facts";
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

/** Every fact of every entry in the slice, in screen order.
 *
 * A verb pair's UNASKABLE side is dropped here. A pair mints a fact per side but
 * only schedules the askable ones (see transitivity-facts.ts); the other rides
 * along solely as a distractor and is never taught or quizzed. Left in, it would
 * sit forever as never-met "teach" work, so a pair could never be drilled empty
 * and its "I know this" button — which hides only when nothing is left to claim
 * — would never disappear. Non-transitivity facts are untouched: transitivitySide
 * returns nothing for them, so the guard keeps them. */
export function sliceFacts(slice: Slice): FactId[] {
  return slice.entries
    .flatMap((e) => factsOf(e))
    .filter((f) => {
      const side = transitivitySide(f);
      return !side || side.askable;
    });
}

/**
 * Is there anything here worth drilling? ONE fact is not a drill.
 *
 * A single kana IS its one reading — か has exactly one fact — so a "drill" of it
 * is a one-question session that teaches nothing the screen above the bar hasn't
 * already shown. The bar hides its Teach me and Quiz buttons on these, and this
 * is the rule it asks. It gates on TOTAL facts, not on how many are unlearned: a kana has one
 * thing to know whether or not you know it, and "one thing to learn → no drill"
 * is the owner's rule. A kanji (meaning + readings) or a word (reading + meaning)
 * clears it; a single kana, or a subject that resolves to one fact, does not.
 */
export function sliceIsDrillable(slice: Slice): boolean {
  return sliceFacts(slice).length > 1;
}

/**
 * How many real questions a Library quiz pool represents.
 *
 * Ordinary facts each represent one thing to quiz. A number-construction fact
 * is deliberately one stored category fact, but it generates a configured
 * round of distinct counts; treating it as one made a category impossible to
 * launch by itself. Callers pass an already-quizzable pool, so this function is
 * only the cardinality rule: more than one form means a quiz can start.
 */
export function quizFormCount(facts: readonly FactId[]): number {
  return facts.reduce(
    (total, fact) => total + (constructionConfigForFact(fact)?.count ?? 1),
    0,
  );
}

/** The one eligibility rule shared by Library shelves and entry pages. */
export function hasMultipleQuizForms(facts: readonly FactId[]): boolean {
  return quizFormCount(facts) > 1;
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
 * SAK-157: `teach` status is ambiguous between two facts that look identical
 * to the arithmetic — never met, and lost to decay (scoring.ts's UNMET
 * comment: both read p → 0 by the same formula, on purpose, "there is no
 * cold-start branch"). standing.ts already resolves that ambiguity for the
 * per-row word: a fact with real showings behind it (`seen > 0`) that has
 * decayed to `teach` is "slipping", not "not seen" — you had it, it's gone.
 * The Library's "Teach me" button must not blur that distinction back
 * together (that was the bug: a genuinely-new kana and a decayed-but-once-
 * known word both landed in `teach` and both read as "not known"). So this
 * loop applies the SAME seen-count check standing.ts uses, on the SAME
 * `FactAggregate`, rather than re-deriving a slightly different rule: only a
 * fact with `seen === 0` enters `teach`.
 *
 * A slipping fact is not moved to `probe` instead — that would look like a
 * fix and not be one. `rank` (scoring.ts) recomputes `statusAt(p)` itself and
 * `continue`s past anything that isn't `"probe"`, so a `teach`-status
 * candidate handed to `rank` is silently dropped right back out; and even if
 * it weren't, `weakness` is ~0 at p → 0 by construction (it peaks at p = 0.5),
 * so it would sort to the bottom of a list capped by the slice's own size —
 * buried, not asked. So a slipping fact is dropped from the plan entirely.
 * Its standing is still visible (the Library's "slipping" status filter,
 * standing.ts) and Practice's "Slipping" chip (selection.ts) is where a
 * learner actually drills it back up — the Library's teach/probe split is not
 * the only door in the app, and re-teaching is not what a slipping fact
 * needs (it doesn't need TEACHING, scoring.ts's own header says as much for
 * `teach` in general: "testing someone on what they don't know is not
 * teaching" — the flip side holds too, re-teaching someone who once knew this
 * is not what closes the gap; testing it is, and Practice is where that
 * happens).
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
        // SAK-157: `seen === 0` is standing.ts's own test for "not seen" vs
        // "slipping" (standingOf), read off the same FactAggregate rather
        // than re-derived. Never-seen enters `teach`; a decayed-but-once-seen
        // fact is dropped from the plan entirely (see the doc comment above).
        if ((facts[id]?.seen ?? 0) === 0) teach.push(id);
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
  /** SAK-157: facts `drillable` also leaves out, for the opposite reason from
   * `solid` — a decayed-but-once-seen ("slipping", standing.ts) fact is not
   * something the model is sure of, it is the thing this whole feature exists
   * to stop mislabelling as unknown. `drillPlan` drops it from the Library's
   * teach/probe split entirely (see its doc comment) whether or not
   * `includeSolid` is set, so it is excluded here on the same terms — named,
   * not folded into `solid`, so the bar can say something TRUE about it
   * instead of a count that is merely smaller than `total` for an
   * unexplained reason. */
  readonly slipping: number;
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
  let slipping = 0;
  for (const id of all) {
    const forms = quizFormCount([id]);
    const everSeen = (facts[id]?.seen ?? 0) > 0;
    if (everSeen) seen += forms;
    const s = status(effectiveState(facts[id], claims[id]), now);
    if (s === "quiet") solid += forms;
    // Mirrors drillPlan's own seen-count check — a decayed fact only counts
    // as "slipping" (and only leaves `drillable`) when it has real showings
    // behind it; a decayed fact with none is plain never-seen and stays in
    // `drillable` via the arithmetic below.
    else if (s === "teach" && everSeen) slipping += forms;
  }
  const total = quizFormCount(all);
  // An explicit selection drills its solid facts too, so they are not the
  // number the button "deliberately isn't": drillable is everything but
  // slipping, and the bar has no solid remainder to explain away. Slipping
  // stays excluded even under includeSolid — that seam rescues `quiet` facts
  // only (see drillPlan), never a `teach`-status one.
  if (includeSolid) return { drillable: total - slipping, total, seen, solid: 0, slipping };
  return { drillable: total - solid - slipping, total, seen, solid, slipping };
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
 *
 * SAK-157 adds one more thing `drillable` can leave out — `slipping` — and it
 * gets its own words rather than being folded into `solid`'s: a slipping fact
 * is not one the model is sure of, it is the opposite, and saying "solid" of
 * it would be exactly the mislabel this feature exists to stop. When it is
 * the ONLY thing standing between `drillable` and `total`, the sentence names
 * it outright ("all 3 slipping, nothing to teach here") rather than reusing
 * the solid wording for a case that is not solid.
 *
 * An empty slice (no facts at all) returns "": there is nothing to summarise and
 * the surface it sits on already shows its own empty-shelf/empty-search message,
 * so the bar stays quiet rather than repeating "nothing here to drill".
 */
export function sliceSentence(c: SliceCount): string {
  if (c.total === 0) return "";
  if (c.drillable === 0) {
    if (c.slipping === 0) return `all ${c.total} solid, nothing to ask`;
    if (c.solid === 0) return `all ${c.total} slipping, nothing to teach here`;
    return `${c.solid} solid, ${c.slipping} slipping, nothing to teach here`;
  }
  if (c.seen === 0) {
    return `${c.drillable} question${c.drillable === 1 ? "" : "s"} · not seen yet`;
  }
  if (c.solid === 0 && c.slipping === 0) {
    return `${c.drillable} question${c.drillable === 1 ? "" : "s"}`;
  }
  const excluded =
    c.solid > 0 && c.slipping > 0
      ? "solid or slipping"
      : c.slipping > 0
        ? "slipping"
        : "solid";
  return `everything here that isn't ${excluded} · ${c.drillable} question${
    c.drillable === 1 ? "" : "s"
  }`;
}

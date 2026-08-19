// TRACK COMPLETION — how many of a track's items a learner has fully met, out of
// the track's own fixed total: "known 5 of 46", never a lesson SPAN (SAK-29).
//
// WHY A COUNT, NOT A SPAN (see lesson-position.ts's "SAFE UNDER OUT-OF-ORDER
// CLAIMS" section, and advancePosition() there for the one safe way to build a
// SPAN). A safe span needs lesson BOUNDARIES frozen independent of history —
// exactly what curriculum-lesson.ts's packLessons() does for the old
// radical/kanji/word spine: every item is assigned to ONE group, forever, and
// the frontier just reports that group's own frozen span, so a claim can change
// WHICH items are still on the card but never the group's from/to/total.
//
// NONE of /learn's live tracks (kana/vocab/numbers/keigo/grammar/transitivity/
// sentence — see unit-tracks.ts) have that property, because none of them are
// actually scheduled by curriculum-lesson.ts any more (that file is unwired
// from /learn's cards — see home-feed.tsx's header). Their lessons are cut on
// the fly by unit-scheduler-core.ts's planUnitLessonCore: it walks the track's
// static order from the front on every call, skipping whatever the learner has
// already claimed (in curriculum order or not) and pulling a due unit's
// untaught prerequisites in from wherever else in the order they sit. There is
// no frozen lesson boundary to look a position up in — the boundary itself is a
// function of history. Taking the min/max frozen rank of THAT lesson's units
// would be exactly SAK-13's bug relocated: a scattered out-of-order claim can
// force the scan to reach far ahead to find enough due material, producing the
// same "1–639 of 2,136" shape lesson-position.test.ts's counter-example test
// pins as unsafe — just computed by a different route. See that test
// ("counter-example: deriving a span from an out-of-order claim's position is
// dishonest") before reaching for a per-lesson span here.
//
// A plain completion COUNT sidesteps the whole problem, and it is the
// alternative learn-index-types.ts's own comment on `curriculumGlyphs` already
// names for this exact situation: "count claimed/seen items directly instead
// ... which is order-independent and cannot suffer this failure mode." It is
// also the same idiom src/components/stats/by-subject.tsx already ships for
// Progress ("70 of 2,136 kanji").
//
// `total` is the track's own DISTINCT-ITEM count over its frozen unit order —
// computed once per call from `units`, never a live recount of what remains,
// the same discipline CURRICULUM_TOTALS uses. `known` tallies how many of those
// items are FULLY met (every fact of every unit the item contributes). A claim
// can only ever move `known` by exactly the items it touches; there is no
// frontier index, no span, nothing for an out-of-order claim to distort.

import { effectiveState } from "@/lib/claims";
import type { EntryId, FactId, HistoryFile } from "@/types";

/** The minimal shape this needs off a teaching unit — satisfied by both the
 * content-backed `TeachingUnit` (teach-unit.ts) and the precomputed `IndexUnit`
 * (learn-index-types.ts), so this runs over either without importing either
 * module and without caring which one a caller has in hand. */
export interface CompletionUnit {
  readonly item: { readonly entry: EntryId };
  readonly facts: readonly FactId[];
}

/** Has every fact of this unit been met — answered, claimed, or "quiz me"'d?
 * The one definition every completion gate in the app reads (curriculum-
 * lesson.ts's itemIsMet, spine-intros.ts's met). */
function unitMet(unit: CompletionUnit, history: HistoryFile): boolean {
  return unit.facts.every((f) => {
    const state = effectiveState(history.facts[f], history.claims?.[f], history.seen?.[f]);
    return state.lastTested > 0;
  });
}

/** A track's completion tally, in ITEMS — deduped by entry, so a word taught
 * across three readings is one item, the same "count the material, never the
 * lesson" idiom lesson-position.ts's header settles for a span. */
export interface TrackCompletion {
  /** How many of the track's distinct items are FULLY met. */
  known: number;
  /** How many distinct items the track teaches — frozen over `units`' own
   * order, never a live recount of what remains. */
  total: number;
}

/**
 * Tally a track's completion: `known` of `total`, deduped to distinct items.
 *
 * `units` must be the track's own STATIC order (unit-tracks.ts / learn-
 * index.ts) — pass the WHOLE track (or, for kana, one script's slice of it),
 * never a history-filtered remainder. The safety here comes entirely from
 * `total` being counted off that fixed set on every call and `known` being a
 * tally over it, not a position derived from any one claim's index.
 */
export function trackCompletion(
  units: readonly CompletionUnit[],
  history: HistoryFile,
): TrackCompletion {
  const byEntry = new Map<string, CompletionUnit[]>();
  for (const unit of units) {
    const key = String(unit.item.entry);
    const list = byEntry.get(key);
    if (list) list.push(unit);
    else byEntry.set(key, [unit]);
  }
  let known = 0;
  for (const list of byEntry.values()) {
    if (list.every((u) => unitMet(u, history))) known++;
  }
  return { known, total: byEntry.size };
}

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

// THE LESSON'S OWN SPAN (SAK-13, reopened) — see the header above for why a
// TRACK's overall "N of M" stays a completion COUNT: there is no frozen lesson
// boundary a history-derived position could read safely. But a home card is not
// only asking "how far have I progressed overall" — it is also asking "what is
// THIS LESSON teaching", and THAT question has a genuinely safe span, because it
// needs no history at all once the scheduler has already chosen `lesson.units`
// for this render: every entry in `order` has a RANK — its 1-based position in
// `order`'s own fixed sequence — that is a property of `order` ALONE, frozen the
// instant `order` is built, before any learner has looked at it. Taking the
// min/max of `lesson.units`' own ranks in `order` is exactly advancePosition's
// SAFE column (lesson-position.ts's header): "freeze positions over the static
// order first, look them up by group second."
//
// This is NOT the same arithmetic as `from = known + 1`, and that distinction is
// the whole point. `known + 1` assumes the lesson being shown is exactly the
// next `y` items after whatever is already known, in `order`'s own order — an
// assumption unit-scheduler-core.ts's planUnitLessonCore does not keep:
// `planUnitLessonCore` walks `order` skipping units a learner has claimed out of
// curriculum order via the Library, and can bundle in an untaught PREREQUISITE
// pulled from wherever else in `order` it happens to sit, so the units actually
// on the card are not guaranteed to be contiguous with "known + 1" at all — see
// this file's own header and lesson-position.test.ts's "counter-example" test for
// the shape that mistake takes. `lessonSpanInTrack` sidesteps the assumption
// entirely: it never asks "how many are known", it asks "where do THESE units
// — the ones the scheduler already put on the card — sit in `order`". An
// out-of-order claim can change WHICH lesson the scheduler builds; it can never
// change what this function reports about the lesson it was actually handed,
// because history is not one of this function's inputs.
//
// A unit the scheduler pulled in from ANOTHER track's own order (e.g. a counter
// lesson's kanji prerequisite, resolved through vocab's pronunciation units —
// see unit-scheduler.ts's `primaryUnit`) has no rank in THIS `order` at all, and
// is silently EXCLUDED rather than reported as an unknown position: the due unit
// that triggered scheduling is always native to `order` (planUnitLessonCore
// walks `order` itself to find it), so there is always at least one native rank
// to report, and the foreign prerequisite is simply credited to whichever
// track's own order it actually belongs to — the same boundary this file's own
// `known`/`total` already draw.
//
// NOT UNCONDITIONALLY TIGHT, and that is truthful, not a bug. A track whose
// prerequisites resolve against a DIFFERENT ordering axis than the track's own
// delivery order (vocab: `order` is sorted by SPOKEN FREQUENCY, but a word's
// kanji-component prerequisite resolves by curriculum Built-from edges — see
// vocabPositionLabel's comment in home-feed.tsx) can pull a same-track
// prerequisite from FAR AWAY in rank, producing a wide span. Simulated
// concretely in track-completion.test.ts: it is not a rare edge case for vocab,
// it is the common shape past the first couple of lessons. The span is still
// exactly the frame `lesson.units` occupies in `order` — the only thing that can
// be said honestly without deriving from history — so it is reported as-is
// rather than suppressed; a caller that cannot tolerate a wide span for a given
// track has to decide that per-track (see home-feed.tsx), not by this function
// lying about what is actually on the card.
/**
 * The current lesson's SAFE span within a track's static order: the 1-based
 * min/max RANK, among `order`'s own distinct entries (deduped exactly like
 * `trackCompletion`'s `total`), of the units `lessonUnits` is actually teaching.
 *
 * `order` must be the track's own STATIC order (unit-tracks.ts / learn-index.ts)
 * — the same array `trackCompletion`'s `units` would be — and `lessonUnits` must
 * be the units the SCHEDULER chose for the lesson currently on screen
 * (`lesson.units`), never a history-filtered remainder of `order` itself.
 *
 * Returns null only when NONE of `lessonUnits` are native to `order` — should
 * not happen in practice (see the header above), but a caller then has nothing
 * honest to print over a fallback rather than a fabricated span.
 */
export function lessonSpanInTrack(
  order: readonly CompletionUnit[],
  lessonUnits: readonly CompletionUnit[],
): { from: number; to: number } | null {
  const rankOf = new Map<string, number>();
  let nextRank = 0;
  for (const unit of order) {
    const key = String(unit.item.entry);
    if (!rankOf.has(key)) rankOf.set(key, ++nextRank);
  }
  const ranks = lessonUnits
    .map((unit) => rankOf.get(String(unit.item.entry)))
    .filter((rank): rank is number => rank !== undefined);
  if (!ranks.length) return null;
  return { from: Math.min(...ranks), to: Math.max(...ranks) };
}

// The coverage bar's arithmetic: counts per standing over the size of the
// whole collection, as shares. Tracked as SAK-298.
//
// THE HONESTY RULE: the bar is always drawn against the size of the whole
// collection, never against a sample or the subset currently filtered. So
// `total` is a separate argument the caller has to state, and whatever the
// counts do not account for is drawn as untouched. A bar that quietly summed
// its own segments would read "all known" for a learner who has met three
// kanji out of two thousand.

import { STANDING_ORDER, type Standing } from "./standing";

export interface CoverageSegment {
  standing: Standing;
  count: number;
  /** 0 to 1 of the whole collection. */
  share: number;
}

export type CoverageCounts = Partial<Record<Standing, number>>;

/**
 * One segment per standing that has a count, in legend order, then the rest
 * of the collection as "not seen". Shares add up to 1 when the counts fit
 * the total; counts past the total are scaled down together so the bar can
 * never overflow, and a caller passing that has a data problem worth seeing
 * in `overflow`.
 */
export function coverageSegments(counts: CoverageCounts, total: number): { segments: CoverageSegment[]; untouched: number; overflow: number } {
  const size = Math.max(0, total);
  const listed = STANDING_ORDER.filter((s) => s !== "not-seen").map((s) => ({ standing: s, count: Math.max(0, counts[s] ?? 0) }));
  const seen = listed.reduce((sum, s) => sum + s.count, 0);
  const overflow = Math.max(0, seen - size);
  // shares are of the collection; past the total they are of the counts, so they still sum to one
  const scale = seen > size ? 1 / seen : 1 / size;
  const segments = size === 0 ? [] : listed.filter((s) => s.count > 0).map((s) => ({ ...s, share: s.count * scale }));
  const untouched = Math.max(0, size - seen);
  return { segments, untouched, overflow };
}

/** "31 of 2,104 known": the headline a bar pairs with. Known is solid or
 * claimed, the same bar as the Library's filter. */
export function knownCount(counts: CoverageCounts): number {
  return (counts.solid ?? 0) + (counts.claimed ?? 0);
}

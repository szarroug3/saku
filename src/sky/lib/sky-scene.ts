// What a learner's sky holds: which items are constellations of their own,
// which stars they share, and the tally the coverage panel shows. Pure, over
// the graph and the items; the page's data adapter decides which items the
// learner has met.

import type { Standing } from "./standing";
import type { PrerequisiteGraph } from "./graph";
import type { CoverageCounts } from "./coverage";

/**
 * The roots of the sky: every met item that is not part of another met item.
 * A learner who knows 日, 本 and 日本 has one constellation, not three; the two
 * kanji are its stars. A kanji met on its own, a kana, a radical learned alone:
 * each is its own constellation, however small.
 */
export function skyRoots(graph: PrerequisiteGraph, met: ReadonlySet<string>): string[] {
  const covered = new Set<string>();
  for (const id of met) if (graph.has(id)) for (const p of graph.closureOf(id)) if (met.has(p)) covered.add(p);
  return [...met].filter((id) => graph.has(id) && !covered.has(id));
}

/** Every star in the sky, each once: the roots and everything under them. */
export function skyStars(graph: PrerequisiteGraph, roots: readonly string[]): string[] {
  const seen = new Set<string>();
  for (const r of roots) for (const id of graph.orderOf(r)) seen.add(id);
  return [...seen];
}

/** How many stars wear each standing. */
export function tallyStandings(ids: readonly string[], standingOf: (id: string) => Standing | undefined): CoverageCounts {
  const counts: Partial<Record<Standing, number>> = {};
  for (const id of ids) {
    const s = standingOf(id);
    if (!s) continue;
    counts[s] = (counts[s] ?? 0) + 1;
  }
  return counts;
}

/** Largest first, for the scatter: the hardest boxes to fit go down first.
 * Ties keep the given order, so the result is stable. */
export function bySizeDesc<T>(items: readonly T[], sizeOf: (t: T) => number): T[] {
  return [...items].map((t, i) => ({ t, i, s: sizeOf(t) })).sort((a, b) => b.s - a.s || a.i - b.i).map((x) => x.t);
}


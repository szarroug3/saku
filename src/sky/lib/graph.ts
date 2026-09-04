// The prerequisite graph: the one shared model of what needs what. Tracked as
// SAK-299.
//
// A word is made of kanji, a kanji of radicals, and a verb pair or keigo form
// attaches to its headword while carrying its own kanji and radicals. Four
// pages read this: the Planetarium prices carts with it, the Lesson locks
// stars with it, the constellation renderer draws from it, the Atlas
// cross-links with it and Practice filters by component with it. So it lives
// here, once, and knows nothing about any of them.
//
// Two rules the whole model rests on:
//
//   - A piece used by two parents is ONE node with one state. 日 is the same
//     star in 日本 and in 時間; a radical shared by two kanji in one word is one
//     star with two lines into it. Every walk in here deduplicates.
//   - An item is available to open when every DIRECT prerequisite is learned.
//     "Learned" is the caller's word (a standing of solid or claimed, see
//     standing.ts); the graph only takes the predicate.
//   - Learning a thing says nothing about its parts. Claiming a word claims
//     the word: its kanji and their radicals keep their own standing, and a
//     lesson or a cart that reaches them still counts and teaches every one
//     that is not learned in its own right. So a walk that takes `learned`
//     skips learned nodes, one by one, and never skips what is beneath them.
//
// Pure: no React, no app imports, no I/O. Built once from a flat list of
// items and then read.

import type { SkyItem } from "./types";

/** Who counts as learned: a set of ids, or a predicate over them. */
export type Learned = ReadonlySet<string> | ((id: string) => boolean);

/** What one pick costs beside what is already learned or already in the cart. */
export interface PickCost {
  /** The new pieces this pick brings, dependencies first, the pick itself last. */
  pieces: readonly string[];
  /** Prerequisites already learned: free, and not drawn as new. */
  free: readonly string[];
  /** Prerequisites an earlier pick in the same cart already brings. */
  shared: readonly string[];
}

/** The shape a constellation is drawn from: every node once, with its depth
 * below the root (a shared piece sits at its deepest use), and every edge
 * from a parent to a part. The root is depth 0. */
export interface Constellation {
  root: string;
  nodes: ReadonlyArray<{ id: string; depth: number }>;
  edges: ReadonlyArray<readonly [from: string, to: string]>;
}

export interface PrerequisiteGraph {
  readonly size: number;
  /** Ids something referred to that were not in the list. Those edges are
   * dropped; the ids are reported so a data problem is visible, not silent. */
  readonly dangling: readonly string[];
  /** Cycles found and cut (the edge that closed each one). A well-formed
   * list has none. */
  readonly cycles: ReadonlyArray<readonly [from: string, to: string]>;
  has(id: string): boolean;
  itemOf(id: string): SkyItem | undefined;
  /** Direct prerequisites: the item's components, plus its headword for a
   * verb pair or keigo form. In the order they were declared. */
  prerequisitesOf(id: string): readonly string[];
  /** Direct dependents: everything this is a component or headword of. */
  dependentsOf(id: string): readonly string[];
  /** Every prerequisite, transitively, each once, dependencies first. */
  closureOf(id: string): readonly string[];
  /** The lesson's sequence: the closure, then the item itself. Pieces, then
   * the kanji, then the word. */
  orderOf(id: string): readonly string[];
  /** Prerequisites not yet learned in their own right, dependencies first.
   * A claimed kanji's unknown radicals are still unmet. */
  unmetPrerequisites(id: string, learned: Learned): readonly string[];
  /** Every direct prerequisite is learned. */
  isAvailable(id: string, learned: Learned): boolean;
  /** What opening this makes available: dependents that are not learned, not
   * available now, and whose every other direct prerequisite is learned. */
  wouldUnlock(id: string, learned: Learned): readonly string[];
  /** What this pick brings, minus what is learned and minus what earlier
   * picks in `prior` already bring. */
  costOf(id: string, learned: Learned, prior?: readonly string[]): PickCost;
  /** Distinct new pieces for a whole set: shared components counted once,
   * learned ones free. The Planetarium's cart total. */
  pieceCount(ids: readonly string[], learned: Learned): number;
  constellationOf(id: string): Constellation;
}

const isLearned = (learned: Learned, id: string) => (typeof learned === "function" ? learned(id) : learned.has(id));

/** Kinds that attach to a headword and take it as a prerequisite. */
const ATTACHED = new Set<SkyItem["kind"]>(["verbPair", "keigo"]);

export function buildGraph(items: readonly SkyItem[]): PrerequisiteGraph {
  const byId = new Map<string, SkyItem>();
  for (const item of items) byId.set(item.id, item);

  // Direct edges, with anything unknown dropped and reported.
  const dangling = new Set<string>();
  const prereqs = new Map<string, string[]>();
  const dependents = new Map<string, string[]>();
  for (const item of items) {
    const wanted = [...(item.headword && ATTACHED.has(item.kind) ? [item.headword] : []), ...(item.components ?? [])];
    const kept: string[] = [];
    for (const id of wanted) {
      if (id === item.id) continue;
      if (!byId.has(id)) { dangling.add(id); continue; }
      if (kept.includes(id)) continue;
      kept.push(id);
    }
    prereqs.set(item.id, kept);
  }

  // Cut cycles: a depth-first walk that drops any edge back into the path.
  // A well-formed list never has one; a corrupt one must not hang the page.
  const cycles: Array<readonly [string, string]> = [];
  const state = new Map<string, "open" | "done">();
  const visit = (id: string) => {
    state.set(id, "open");
    const kept = prereqs.get(id) ?? [];
    for (const p of [...kept]) {
      const s = state.get(p);
      if (s === "open") { cycles.push([id, p]); kept.splice(kept.indexOf(p), 1); continue; }
      if (s === undefined) visit(p);
    }
    state.set(id, "done");
  };
  for (const item of items) if (!state.has(item.id)) visit(item.id);

  for (const [id, kept] of prereqs) for (const p of kept) dependents.set(p, [...(dependents.get(p) ?? []), id]);

  const prerequisitesOf = (id: string) => prereqs.get(id) ?? [];
  const dependentsOf = (id: string) => dependents.get(id) ?? [];

  // The closure, dependencies first: a post-order walk, each node once. Cached
  // because every reader asks for it, and the graph does not change.
  const closures = new Map<string, readonly string[]>();
  const closureOf = (id: string): readonly string[] => {
    const hit = closures.get(id);
    if (hit) return hit;
    const out: string[] = [];
    const seen = new Set<string>([id]);
    const walk = (node: string) => {
      for (const p of prerequisitesOf(node)) {
        if (seen.has(p)) continue;
        seen.add(p);
        walk(p);
        out.push(p);
      }
    };
    walk(id);
    closures.set(id, out);
    return out;
  };
  const orderOf = (id: string) => (byId.has(id) ? [...closureOf(id), id] : []);

  const isAvailable = (id: string, learned: Learned) => byId.has(id) && prerequisitesOf(id).every((p) => isLearned(learned, p));

  // What still has to be learned for `id`: its order, minus every node that
  // is learned in its own right, and minus groups, which are never pieces.
  // Nothing is skipped for sitting under a learned node. `met` collects the
  // learned nodes, in the order they came.
  const needed = (id: string, learned: Learned, met?: string[]): string[] => {
    const out: string[] = [];
    for (const n of orderOf(id)) {
      if (byId.get(n)?.group) continue;
      if (isLearned(learned, n)) met?.push(n);
      else out.push(n);
    }
    return out;
  };

  const costOf = (id: string, learned: Learned, prior: readonly string[] = []): PickCost => {
    if (!byId.has(id)) return { pieces: [], free: [], shared: [] };
    const broughtBefore = new Set<string>();
    for (const earlier of prior) if (earlier !== id) for (const n of needed(earlier, learned)) broughtBefore.add(n);
    const free: string[] = [];
    const pieces: string[] = [], shared: string[] = [];
    for (const n of needed(id, learned, free)) (broughtBefore.has(n) ? shared : pieces).push(n);
    return { pieces, free, shared };
  };

  return {
    size: byId.size,
    dangling: [...dangling],
    cycles,
    has: (id) => byId.has(id),
    itemOf: (id) => byId.get(id),
    prerequisitesOf,
    dependentsOf,
    closureOf,
    orderOf,
    unmetPrerequisites: (id, learned) => needed(id, learned).filter((n) => n !== id),
    isAvailable,
    wouldUnlock: (id, learned) => {
      const after: Learned = (n) => n === id || isLearned(learned, n);
      return dependentsOf(id).filter((d) => !isLearned(learned, d) && !isAvailable(d, learned) && isAvailable(d, after));
    },
    costOf,
    pieceCount: (ids, learned) => {
      const counted = new Set<string>();
      for (const id of ids) for (const n of needed(id, learned)) counted.add(n);
      return counted.size;
    },
    constellationOf: (id) => {
      if (!byId.has(id)) return { root: id, nodes: [], edges: [] };
      const depth = new Map<string, number>([[id, 0]]);
      const edges: Array<readonly [string, string]> = [];
      const edgeSeen = new Set<string>();
      const walk = (node: string) => {
        const d = depth.get(node)! + 1;
        for (const p of prerequisitesOf(node)) {
          const key = node + " " + p;
          if (!edgeSeen.has(key)) { edgeSeen.add(key); edges.push([node, p]); }
          const before = depth.get(p);
          // a shared piece sits at its deepest use, so it lands on the outer ring
          if (before === undefined || before < d) { depth.set(p, d); walk(p); }
        }
      };
      walk(id);
      const nodes = orderOf(id).map((n) => ({ id: n, depth: depth.get(n) ?? 0 })).reverse();
      return { root: id, nodes, edges };
    },
  };
}

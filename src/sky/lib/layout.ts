// Canopy layout: WHERE every branch tip belongs, decided top-down, before
// any branch is drawn. Expressed purely in terms of the generic Branch shape
// (subtree size and height, sibling order) — no knowledge of what a branch
// represents, so it applies the same way to a word's kanji as to a kanji's
// radicals. Dimensionless throughout (degrees and ratios); tree-geometry.ts
// turns it into pixels. SAK-332/333.
//
// Why tips first. The previous layout grew the tree outward: each child's
// angle was its parent's direction plus an offset, clamped by a window,
// capped by a ceiling, with room reserved for descendants. Those rules all
// competed for one fixed budget (a branch can't point sideways), and three
// chained generations each wanting a real kink needed more than the budget
// held — so every fix for one rule starved another. Reference trees don't
// look like the OUTPUT of such rules anyway: they look like a dome. Every
// tip sits on a rounded canopy, boughs fan out to fill it, and blossoms
// sit on the rim. So: partition the dome into disjoint wedges (a word gets
// a wedge, its kanji get sub-wedges, its radicals get slots on the rim),
// put each tip in its own wedge, and let the branch angles fall out of
// where the tips are. Siblings can't cross because their wedges are
// disjoint; nothing can exceed the fan because the fan is what's being
// partitioned; and there's no compounding, because a child's angle is a
// position inside an allotted slice, not an increment on its parent.
//
// The parent's own tip is part of the partition too. A branch with
// children keeps going past its last fork to its own tip (where its own
// flower goes — SAK-335), and that stub takes up room in the fan just like
// a child does. If the children alone tiled the parent's wedge, one
// child's territory would straddle the parent's continuing curve, and
// that child's OWN children — fanning across its whole territory — would
// have to cross the parent to reach the far side of it. So the stub is
// dealt a slice of its own (weighted like one leaf, since it holds one
// flower), the parent's tip sits in that slice, and every child's whole
// subtree lives entirely to one side of the parent's continuation.

import type { Branch } from "@/sky/lib/branch";

// ============================================================================
// Config — every tunable constant, grouped here so they're easy to find and
// change without hunting through the functions below.
// ============================================================================

/**
 * Half the total fan the canopy spans, in degrees off vertical: the dome
 * runs from -this (leftmost tip) to +this (rightmost tip). Deliberately
 * close to 90: the reference trees' outermost boughs run nearly
 * horizontal, and a tip AT the rim's edge is the one place that's fine.
 */
export const CANOPY_HALF_SPREAD_DEGREES = 75;

/**
 * The narrowest wedge any branch (or tip stub) is dealt, whatever its
 * leaf-weight share would otherwise be, so a one-radical word next to a
 * twenty-radical one still reads as a branch rather than a sliver.
 * Enforced by rescaling the whole group when the floors alone would
 * overflow the parent wedge — in that (crowded) case wedges can come in
 * under this, evenly.
 */
export const MIN_WEDGE_DEGREES = 12;

/**
 * The share of its parent's wedge a branch's OWN tip stub is dealt,
 * measured in leaves (a leaf is 1). 1 because the stub holds exactly one
 * flower — the parent's own — so it needs the same rim room a leaf does.
 * See the header for why the stub is in the partition at all. Raising this
 * pushes children further off their parent's heading (bigger kinks);
 * lowering it tucks them in closer.
 */
export const STUB_LEAF_WEIGHT = 1;

/**
 * How far a tip may sit from the centre of its own slice, as a fraction of
 * the slice's width — seeded per branch, so two same-shaped subtrees don't
 * mirror each other exactly. Well under 0.5, so a tip can never leave its
 * slice, which is what keeps siblings from crossing.
 */
export const TIP_ANGLE_JITTER_RATIO = 0.15;

/**
 * How far in from the canopy rim a branch's OWN tip sits for every
 * generation still below it: a leaf's tip is on the rim (ratio 1); a
 * branch whose children are leaves sits this much inside it; a branch two
 * generations up sits twice this much inside; and so on. This is what
 * makes a word a bough, a kanji a branch, and a radical a twig on the rim,
 * with no depth hard-coded anywhere — subtree height decides.
 */
export const TIP_INSET_PER_LEVEL = 0.22;

/** Floor for the ratio above, so a very deep tree's innermost boughs still
 * clear the trunk top rather than collapsing onto it. */
export const TIP_RADIUS_RATIO_MIN = 0.3;

/**
 * Where along a PARENT branch (0 at its origin, 1 at its tip) its children
 * fork off: spread evenly across this range in fork order, with a small
 * seeded jitter that can never push one sibling's fork past another's.
 * Stops short of 1 so the parent keeps its stub past the last fork.
 */
export const FORK_T_MIN = 0.3;
export const FORK_T_MAX = 0.85;

/** The same range for the TRUNK's own children (the top-level branches).
 * Higher than a branch's: the references fork their boughs from the upper
 * part of the trunk, leaving a clean length of bare trunk below. */
export const TRUNK_FORK_T_MIN = 0.5;
export const TRUNK_FORK_T_MAX = 0.95;

/** Fork-position jitter, as a fraction of half the gap between evenly
 * spaced neighbours — so it can never reorder them. */
export const FORK_T_JITTER_RATIO = 0.3;

// ============================================================================

/**
 * Leaf descendants of a branch — itself counted as 1 if it has none. The
 * weight used to size wedges: a subtree with many leaves needs more of the
 * rim, so its eventual flowers (SAK-335) don't crowd its siblings'.
 */
export function subtreeLeafCount(branch: Branch): number {
  if (branch.branches.length === 0) return 1;
  return branch.branches.reduce((sum, child) => sum + subtreeLeafCount(child), 0);
}

/** Generations below a branch: 0 for a leaf, 1 for a branch whose children
 * are all leaves, and so on. Decides how far inside the rim its tip sits —
 * see TIP_INSET_PER_LEVEL. */
export function subtreeHeight(branch: Branch): number {
  if (branch.branches.length === 0) return 0;
  return 1 + Math.max(...branch.branches.map(subtreeHeight));
}

/**
 * A small deterministic PRNG seeded by a string (xmur3 hash into
 * mulberry32), so the same branch gets the same "random" jitter on every
 * render — server and client alike. A real Math.random() here would desync
 * server-rendered HTML from the client's first render and produce a
 * hydration mismatch; seeding by branch id sidesteps that while still
 * varying visibly from one branch to the next.
 */
export function seededRandom(seed: string): number {
  let h = 1779033703 ^ seed.length;
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  h = Math.imul(h ^ (h >>> 16), 2246822519);
  h = Math.imul(h ^ (h >>> 13), 3266489917);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296; // unsigned, normalized to [0, 1)
}

/** One branch's place in the canopy. Mirrors the Branch tree's shape. */
export interface CanopyNode {
  branch: Branch;
  /** 1 for a top-level branch (off the trunk), 2 for its children, ... */
  depth: number;
  /** The slice of the fan this branch and its whole subtree live in, in
   * degrees off vertical — disjoint from every sibling's. */
  wedge: readonly [number, number];
  /** Where this branch's own tip sits, in degrees off vertical. Inside
   * `wedge`, always — inside its own stub slice of it, in fact, so no
   * child's sub-wedge straddles the branch's own continuation. */
  tipAngle: number;
  /** How far out from the canopy centre the tip sits, as a fraction of the
   * canopy radius: 1 for a leaf (on the rim), less for each generation
   * still below it — see TIP_INSET_PER_LEVEL. */
  tipRadiusRatio: number;
  /** Where along the PARENT (0 origin, 1 tip) this branch forks off. */
  forkT: number;
  children: CanopyNode[];
}

type Slice = readonly [number, number];

/**
 * Splits `wedge` into contiguous slices, in order, each proportional to
 * its weight, floored at MIN_WEDGE_DEGREES (and rescaled to fit if the
 * floors alone would overflow).
 */
function partitionWedge(weights: readonly number[], wedge: Slice): Slice[] {
  const total = wedge[1] - wedge[0];
  const weightSum = weights.reduce((a, b) => a + b, 0);
  let widths = weights.map((w) => Math.max((w / weightSum) * total, MIN_WEDGE_DEGREES));
  const widthSum = widths.reduce((a, b) => a + b, 0);
  if (widthSum > total) widths = widths.map((w) => (w * total) / widthSum);

  let cursor = wedge[0];
  return widths.map((w) => {
    const slice: Slice = [cursor, cursor + w];
    cursor += w;
    return slice;
  });
}

function centreOf(slice: Slice, seed: string): number {
  const jitter = (seededRandom(`${seed}:tipAngle`) * 2 - 1) * (slice[1] - slice[0]) * TIP_ANGLE_JITTER_RATIO;
  return (slice[0] + slice[1]) / 2 + jitter;
}

/**
 * Fork order: the child whose tip swings FARTHEST from the parent's own
 * heading forks EARLIEST, nearest the parent's origin, so it has the most
 * room to swing out; the child heading nearly where the parent heads
 * forks last, near the parent's tip. Children forking in the opposite
 * order cut across each other on the way to their tips. Positions are
 * spread evenly over `forkRange` in that order, each jittered by less than
 * half the gap to its neighbours so the order can never flip.
 */
function assignForkPositions(children: CanopyNode[], parentTipAngle: number, forkRange: Slice): void {
  const order = children
    .map((_, i) => i)
    .sort((x, y) => Math.abs(children[y].tipAngle - parentTipAngle) - Math.abs(children[x].tipAngle - parentTipAngle));
  const [tMin, tMax] = forkRange;
  const step = children.length > 1 ? (tMax - tMin) / (children.length - 1) : 0;
  const jitterRange = (children.length > 1 ? step / 2 : (tMax - tMin) / 2) * FORK_T_JITTER_RATIO;
  order.forEach((childIndex, rank) => {
    const base = children.length > 1 ? tMin + rank * step : (tMin + tMax) / 2;
    const jitter = (seededRandom(`${children[childIndex].branch.id}:forkT`) * 2 - 1) * jitterRange;
    children[childIndex].forkT = base + jitter;
  });
}

/**
 * Lays out one branch inside `wedge`: its own tip, and (recursively) its
 * children in their own slices of that wedge.
 *
 * A leaf's tip sits at its wedge's centre. A branch WITH children splits
 * its wedge among the children AND its own tip stub (STUB_LEAF_WEIGHT):
 * the stub goes in the middle of the sequence for two or more children
 * (so they fan out either side of the parent's continuation), and for a
 * lone child it alternates side by generation, so a solo chain zigzags
 * rather than leaning ever further one way. The branch's tip sits in the
 * stub slice; its radius is on the rim for a leaf and one
 * TIP_INSET_PER_LEVEL step inside per generation still below it.
 */
function layoutNode(branch: Branch, wedge: Slice, depth: number): CanopyNode {
  const tipRadiusRatio = Math.max(TIP_RADIUS_RATIO_MIN, 1 - TIP_INSET_PER_LEVEL * subtreeHeight(branch));
  const kids = branch.branches;

  if (kids.length === 0) {
    return { branch, depth, wedge, tipAngle: centreOf(wedge, branch.id), tipRadiusRatio, forkT: 0, children: [] };
  }

  const stubIndex = kids.length === 1 ? (depth % 2 === 0 ? 1 : 0) : Math.floor(kids.length / 2);
  const weights = kids.map(subtreeLeafCount);
  weights.splice(stubIndex, 0, STUB_LEAF_WEIGHT);
  const slices = partitionWedge(weights, wedge);
  const tipAngle = centreOf(slices[stubIndex], branch.id);

  const children = kids.map((kid, i) => layoutNode(kid, slices[i < stubIndex ? i : i + 1], depth + 1));
  assignForkPositions(children, tipAngle, [FORK_T_MIN, FORK_T_MAX]);

  return { branch, depth, wedge, tipAngle, tipRadiusRatio, forkT: 0, children };
}

/**
 * The whole canopy for a cart's top-level Branch[]: the full fan
 * [-CANOPY_HALF_SPREAD_DEGREES, +CANOPY_HALF_SPREAD_DEGREES] partitioned
 * among the top-level branches (no stub here — the trunk top is the
 * canopy's centre, not a flower slot), recursively. The trunk's heading is
 * straight up (0), and its children fork along TRUNK_FORK_T_MIN..MAX.
 */
export function layoutCanopy(branches: readonly Branch[]): CanopyNode[] {
  if (branches.length === 0) return [];
  const slices = partitionWedge(branches.map(subtreeLeafCount), [
    -CANOPY_HALF_SPREAD_DEGREES,
    CANOPY_HALF_SPREAD_DEGREES,
  ]);
  const nodes = branches.map((branch, i) => layoutNode(branch, slices[i], 1));
  assignForkPositions(nodes, 0, [TRUNK_FORK_T_MIN, TRUNK_FORK_T_MAX]);
  return nodes;
}

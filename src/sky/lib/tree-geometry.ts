// The Garden tree's geometry: the canopy plan (src/sky/lib/layout.ts —
// degrees and ratios) turned into pixels, walked once into a flat list of
// branch geometry. No React, no JSX. src/sky/components/tree.tsx renders
// this list (each entry has everything curve.ts's curvedPathD needs);
// src/sky/lib/tree-geometry.test.ts checks it for unwanted crossings
// (intersect.ts) — the same list drives both, so there is nothing to keep
// in sync by hand. SAK-333.
//
// Each branch is drawn FROM its fork point on its parent TO its own tip on
// the canopy. Angle and length are consequences of those two points, not
// inputs — the whole reason this layout replaced the previous one, which
// computed angles as clamped increments and could not keep three chained
// generations inside the fan (see layout.ts's header).

import { branchEndpoint, curveTangentAngle, flattenCurve, pointOnCurve, type Point } from "@/sky/lib/curve";
import { layoutCanopy, subtreeLeafCount, type CanopyNode } from "@/sky/lib/layout";
import type { Branch } from "@/sky/lib/branch";

// ============================================================================
// Config — every tunable constant, grouped here so they're easy to find and
// change without hunting through the functions below.
// ============================================================================

export const TRUNK_BASE: Point = { x: 200, y: 400 };
export const TRUNK_TOP: Point = { x: 200, y: 220 };

/**
 * The canopy's radius, in pixels, around its centre (the trunk top):
 * BASE for an empty-ish cart, growing PER_LEAF for every leaf the cart
 * holds, up to MAX (the viewBox's own headroom — see Tree's VIEW_MARGIN).
 * This is what makes the tree visibly grow as the learner adds to it,
 * rather than the same dome getting more crowded.
 */
export const CANOPY_RADIUS_BASE = 110;
export const CANOPY_RADIUS_PER_LEAF = 14;
export const CANOPY_RADIUS_MAX = 200;

// ============================================================================

/** The canopy radius a given cart renders with — see CANOPY_RADIUS_*. */
export function canopyRadius(branches: readonly Branch[]): number {
  const leaves = branches.reduce((sum, b) => sum + subtreeLeafCount(b), 0);
  return Math.min(CANOPY_RADIUS_MAX, CANOPY_RADIUS_BASE + CANOPY_RADIUS_PER_LEAF * leaves);
}

export interface BranchGeometry {
  id: string;
  /** null for a top-level branch (its "parent" is the trunk, which isn't a
   * Branch and so isn't in this list). */
  parentId: string | null;
  /** 1 for a top-level branch, 2 for its children, ... Drives taper. */
  depth: number;
  /** Where the branch forks off its parent (or the trunk). */
  origin: Point;
  /** Where the branch ends — its place on the canopy. */
  tip: Point;
  /** Direction from origin to tip, degrees off vertical (0 = straight up,
   * positive = right). A consequence of the two points, not an input. */
  angle: number;
  /** Distance from origin to tip. */
  length: number;
  /** The direction this branch's curve leaves `origin` continuing in — the
   * PARENT's actual local tangent at the fork point (0 for a top-level
   * branch, since the trunk is straight). See curve.ts. */
  startDirectionAngle: number;
  /** The curve flattened into a polyline, for geometry checks (e.g.
   * crossings) that are impractical against the true bezier. */
  points: Point[];
}

/** Direction (same convention as every angle here) and distance from one
 * point to another. */
function directionTo(from: Point, to: Point): { angle: number; length: number } {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  return { angle: (Math.atan2(dx, -dy) * 180) / Math.PI, length: Math.hypot(dx, dy) };
}

function walk(
  node: CanopyNode,
  parentId: string | null,
  origin: Point,
  startDirectionAngle: number,
  radius: number,
  out: BranchGeometry[],
): void {
  const tip = branchEndpoint(TRUNK_TOP, node.tipAngle, radius * node.tipRadiusRatio);
  const { angle, length } = directionTo(origin, tip);
  const id = node.branch.id;

  out.push({
    id,
    parentId,
    depth: node.depth,
    origin,
    tip,
    angle,
    length,
    startDirectionAngle,
    points: flattenCurve(origin, length, angle, id, startDirectionAngle),
  });

  for (const child of node.children) {
    // The child forks from a point ON this branch's rendered curve, and its
    // own curve continues from the direction this branch is actually
    // heading there — not this branch's overall angle, which the curve is
    // still opening out toward partway along.
    const childOrigin = pointOnCurve(origin, length, angle, id, startDirectionAngle, child.forkT);
    const childStart = curveTangentAngle(origin, length, angle, id, startDirectionAngle, child.forkT);
    walk(child, id, childOrigin, childStart, radius, out);
  }
}

/**
 * Walks a cart's top-level Branch[] into a flat list of every branch's
 * geometry — one entry per branch, at any depth, each carrying what it
 * needs to be drawn and what it needs to be geometry-checked.
 */
export function computeTreeGeometry(branches: readonly Branch[]): BranchGeometry[] {
  const out: BranchGeometry[] = [];
  const radius = canopyRadius(branches);

  for (const node of layoutCanopy(branches)) {
    // The trunk is a straight line from base to top, so a fork at forkT is
    // a plain interpolation and the local tangent there is always 0.
    const origin: Point = {
      x: TRUNK_BASE.x + (TRUNK_TOP.x - TRUNK_BASE.x) * node.forkT,
      y: TRUNK_BASE.y + (TRUNK_TOP.y - TRUNK_BASE.y) * node.forkT,
    };
    walk(node, null, origin, 0, radius, out);
  }

  return out;
}

/**
 * A position-based label per branch — "b2b3b1" reads as "the 1st branch of
 * the 3rd branch of the 2nd top-level branch" — for talking about a
 * specific branch in a screenshot without describing its coordinates.
 * Numbered LEFT TO RIGHT by rendered angle within each sibling group.
 */
export function labelBranches(geometry: readonly BranchGeometry[]): Map<string, string> {
  const childrenByParent = new Map<string | null, BranchGeometry[]>();
  for (const g of geometry) {
    const siblings = childrenByParent.get(g.parentId) ?? [];
    siblings.push(g);
    childrenByParent.set(g.parentId, siblings);
  }
  for (const siblings of childrenByParent.values()) {
    siblings.sort((a, b) => a.angle - b.angle); // most negative (leftmost) first
  }

  const labels = new Map<string, string>();
  const assign = (parentId: string | null, parentLabel: string): void => {
    const siblings = childrenByParent.get(parentId) ?? [];
    siblings.forEach((g, i) => {
      const label = `${parentLabel}b${i + 1}`;
      labels.set(g.id, label);
      assign(g.id, label);
    });
  };
  assign(null, "");

  return labels;
}

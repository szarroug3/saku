// Pure curve geometry for the Garden tree: cubic bezier construction and
// evaluation. Extracted out of src/sky/components/tree.tsx (no React, no
// JSX) so it can be unit-tested directly, including automated
// self-intersection checks (src/sky/lib/intersect.ts) — the class of bug
// that kept slipping through as "looks fine in the numbers, wrong once
// actually rendered at size." SAK-333.

import { seededRandom } from "@/sky/lib/layout";

export type Point = { x: number; y: number };

export function branchEndpoint(origin: Point, angleDegrees: number, length: number): Point {
  const angleRad = (angleDegrees * Math.PI) / 180;
  return {
    x: origin.x + length * Math.sin(angleRad),
    y: origin.y - length * Math.cos(angleRad),
  };
}

/** How far each control point reaches out, as a fraction of the segment's
 * own length. */
export const CURVE_REACH_RATIO = 0.3;

/**
 * How much of the way from `startDirectionAngle` (see curveControlPoints)
 * to the branch's OWN final angle the first control point commits to,
 * versus the second. 0.3 means the curve leaves origin heading only 30% of
 * the way toward its eventual angle — mostly still continuing in
 * `startDirectionAngle` — and the second control point uses the FULL
 * angle, so the curve arrives at its tip heading exactly where layout says
 * it should, having opened outward like the top of the "C" over its
 * length. A branch that instead leaves ALREADY heading toward its full
 * sideways angle (large early blend) reads as curving sideways-then-up,
 * backwards from how a real branch grows out of its parent.
 */
export const CURVE_START_ANGLE_BLEND = 0.45;

/**
 * How much the curve's ARRIVAL direction at its tip is pulled back toward
 * vertical from the straight origin-to-tip direction. 0 arrives heading
 * exactly along the chord; 0.3 arrives noticeably more upright — the
 * "reaching for the sky" curl at the end of every bough in a real tree,
 * which a straight arrival lacks. The tip itself doesn't move; only how
 * the curve gets there.
 */
export const CURVE_END_ANGLE_BLEND = 0.3;

/** A little extra perpendicular jitter on each control point, small relative
 * to CURVE_REACH_RATIO's own shaping, purely for organic texture. */
export const CURVE_WOBBLE_RATIO = 0.035;

/**
 * The two control points for a cubic bezier from `origin` to `end`, built
 * from THIS branch's own `length` and `targetAngle` — no reference to any
 * other segment's SHAPE, so it can never run parallel to (or cross) a
 * parent or sibling's curve, which is what an earlier version that copied
 * the parent's own FINAL angle did once actually rendered at size — with
 * ONE exception: `startDirectionAngle`, the direction this curve leaves
 * `origin` continuing in before opening out to `targetAngle`. This is NOT
 * the parent's own final angle (that's the earlier bug) — it's whatever
 * direction was already being headed in at the exact point this curve
 * forks off from (0°/straight-up for a branch forking off the trunk,
 * since the trunk is a straight line everywhere along its length; the
 * PARENT's own local tangent at the fork point — see curveTangentAngle —
 * for a branch forking off another branch). Passing the parent's OVERALL
 * angle here instead (as if the parent, too, were a straight line) can
 * make a branch that forks late along an already-curving parent visibly
 * kink AWAY from the direction the parent is actually heading at that
 * point, before swinging back out to targetAngle — reading as looping
 * back over the parent's own curve rather than continuing out of it.
 *
 * The first control point sits along a PARTIAL angle (CURVE_START_ANGLE_
 * BLEND of the way from startDirectionAngle to targetAngle) — so the curve
 * leaves origin mostly continuing in startDirectionAngle, the way a new
 * shoot initially continues whatever direction it forked off in — and the
 * second sits along the FULL targetAngle, so the curve arrives at its tip
 * heading exactly where layout placed it.
 */
export function curveControlPoints(
  origin: Point,
  length: number,
  targetAngle: number,
  seed: string,
  startDirectionAngle: number,
): { c1: Point; c2: Point } {
  const end = branchEndpoint(origin, targetAngle, length);
  if (length === 0) return { c1: origin, c2: end };

  const reach = length * CURVE_REACH_RATIO;
  const startAngle = startDirectionAngle + (targetAngle - startDirectionAngle) * CURVE_START_ANGLE_BLEND;

  const c1Base = branchEndpoint(origin, startAngle, reach);
  // Placed BEHIND `end`, opposite the arrival direction, so the curve's
  // derivative at t=1 (proportional to end - c2) points along endAngle:
  // the chord direction pulled part-way back toward vertical, so the
  // branch arrives at its tip reaching upward — see CURVE_END_ANGLE_BLEND.
  const endAngle = targetAngle * (1 - CURVE_END_ANGLE_BLEND);
  const c2Base = branchEndpoint(end, endAngle + 180, reach);

  // Perpendicular to the chord, purely for the small wobble below.
  const dx = end.x - origin.x;
  const dy = end.y - origin.y;
  const chordLength = Math.hypot(dx, dy) || 1;
  const perpX = -dy / chordLength;
  const perpY = dx / chordLength;
  const wobble1 = (seededRandom(`${seed}:wobble1`) * 2 - 1) * length * CURVE_WOBBLE_RATIO;
  const wobble2 = (seededRandom(`${seed}:wobble2`) * 2 - 1) * length * CURVE_WOBBLE_RATIO;

  return {
    c1: { x: c1Base.x + perpX * wobble1, y: c1Base.y + perpY * wobble1 },
    c2: { x: c2Base.x + perpX * wobble2, y: c2Base.y + perpY * wobble2 },
  };
}

export function curvedPathD(
  origin: Point,
  length: number,
  targetAngle: number,
  seed: string,
  startDirectionAngle: number,
): string {
  const end = branchEndpoint(origin, targetAngle, length);
  const { c1, c2 } = curveControlPoints(origin, length, targetAngle, seed, startDirectionAngle);
  return `M ${origin.x} ${origin.y} C ${c1.x} ${c1.y} ${c2.x} ${c2.y} ${end.x} ${end.y}`;
}

/**
 * The point at parameter `t` (0 at origin, 1 at end) along the SAME cubic
 * bezier curvedPathD draws for this origin/length/targetAngle/seed/
 * startDirectionAngle — so a fork point derived this way always lies
 * exactly on the rendered curve.
 */
export function pointOnCurve(
  origin: Point,
  length: number,
  targetAngle: number,
  seed: string,
  startDirectionAngle: number,
  t: number,
): Point {
  const end = branchEndpoint(origin, targetAngle, length);
  const { c1, c2 } = curveControlPoints(origin, length, targetAngle, seed, startDirectionAngle);
  const mt = 1 - t;
  return {
    x: mt * mt * mt * origin.x + 3 * mt * mt * t * c1.x + 3 * mt * t * t * c2.x + t * t * t * end.x,
    y: mt * mt * mt * origin.y + 3 * mt * mt * t * c1.y + 3 * mt * t * t * c2.y + t * t * t * end.y,
  };
}

/**
 * The direction (same convention as every other angle here: degrees off
 * vertical) this SAME curve is actually heading at parameter `t` — its
 * tangent, via the standard cubic bezier derivative. Used to find what
 * direction a PARENT curve is really heading at the exact point a child
 * forks off it, so the child's own curve (see curveControlPoints'
 * `startDirectionAngle`) can continue smoothly from there instead of
 * resetting to some fixed reference the parent may no longer be pointing
 * anywhere near, once forking late along an already-curving parent.
 */
export function curveTangentAngle(
  origin: Point,
  length: number,
  targetAngle: number,
  seed: string,
  startDirectionAngle: number,
  t: number,
): number {
  const end = branchEndpoint(origin, targetAngle, length);
  const { c1, c2 } = curveControlPoints(origin, length, targetAngle, seed, startDirectionAngle);
  const mt = 1 - t;
  // B'(t) = 3(1-t)²(C1-P0) + 6(1-t)t(C2-C1) + 3t²(P3-C2)
  const dx = 3 * mt * mt * (c1.x - origin.x) + 6 * mt * t * (c2.x - c1.x) + 3 * t * t * (end.x - c2.x);
  const dy = 3 * mt * mt * (c1.y - origin.y) + 6 * mt * t * (c2.y - c1.y) + 3 * t * t * (end.y - c2.y);
  if (dx === 0 && dy === 0) return targetAngle; // degenerate (e.g. zero length) — no real tangent to report
  return (Math.atan2(dx, -dy) * 180) / Math.PI;
}

/**
 * Samples the cubic bezier into `segments` straight-line pieces. Exact
 * geometric checks against a true cubic curve (e.g. "do these two branches
 * cross") are impractical; a fine enough polyline approximation is the
 * standard way to make that checkable with plain segment-intersection tests.
 */
export function flattenCurve(
  origin: Point,
  length: number,
  targetAngle: number,
  seed: string,
  startDirectionAngle: number,
  segments = 16,
): Point[] {
  const points: Point[] = [];
  for (let i = 0; i <= segments; i++) {
    points.push(pointOnCurve(origin, length, targetAngle, seed, startDirectionAngle, i / segments));
  }
  return points;
}

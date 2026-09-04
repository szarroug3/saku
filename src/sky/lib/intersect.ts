// Line-segment intersection: the standard orientation-based test (see e.g.
// Cormen et al., "Introduction to Algorithms", segment-intersection
// section), applied here to catch branch curves crossing each other — the
// exact class of bug that kept slipping through as "looks fine in the
// numbers, tangled once actually rendered at size" while iterating on
// SAK-333's curve shape by eye. Flatten each branch's curve (curve.ts's
// flattenCurve) into a polyline, then ask whether two polylines cross
// anywhere with polylinesIntersect.

import type { Point } from "@/sky/lib/curve";

/**
 * 0 if p, q, r are collinear; 1 if the turn p->q->r is clockwise; 2 if
 * counterclockwise. The sign of the 2D cross product of (q-p) and (r-q).
 */
function orientation(p: Point, q: Point, r: Point): number {
  const val = (q.y - p.y) * (r.x - q.x) - (q.x - p.x) * (r.y - q.y);
  if (Math.abs(val) < 1e-9) return 0;
  return val > 0 ? 1 : 2;
}

/** Whether q lies within p and r's bounding box, given p, q, r are already
 * known to be collinear. */
function onSegment(p: Point, q: Point, r: Point): boolean {
  const eps = 1e-9;
  return (
    q.x <= Math.max(p.x, r.x) + eps &&
    q.x >= Math.min(p.x, r.x) - eps &&
    q.y <= Math.max(p.y, r.y) + eps &&
    q.y >= Math.min(p.y, r.y) - eps
  );
}

/** Whether segment p1-q1 crosses segment p2-q2 (general case via differing
 * orientations, plus the collinear-overlap special cases). */
export function segmentsIntersect(p1: Point, q1: Point, p2: Point, q2: Point): boolean {
  const o1 = orientation(p1, q1, p2);
  const o2 = orientation(p1, q1, q2);
  const o3 = orientation(p2, q2, p1);
  const o4 = orientation(p2, q2, q1);

  if (o1 !== o2 && o3 !== o4) return true;

  if (o1 === 0 && onSegment(p1, p2, q1)) return true;
  if (o2 === 0 && onSegment(p1, q2, q1)) return true;
  if (o3 === 0 && onSegment(p2, p1, q2)) return true;
  if (o4 === 0 && onSegment(p2, q1, q2)) return true;

  return false;
}

/**
 * Whether open polylines `a` and `b` cross anywhere, checking every segment
 * of one against every segment of the other. O(|a| * |b|) — fine at the
 * point counts flattenCurve produces (a few dozen), not meant for dense
 * geometry.
 */
export function polylinesIntersect(a: readonly Point[], b: readonly Point[]): boolean {
  for (let i = 0; i < a.length - 1; i++) {
    for (let j = 0; j < b.length - 1; j++) {
      if (segmentsIntersect(a[i], a[i + 1], b[j], b[j + 1])) return true;
    }
  }
  return false;
}

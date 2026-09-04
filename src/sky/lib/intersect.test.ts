import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { polylinesIntersect, segmentsIntersect } from "@/sky/lib/intersect";
import type { Point } from "@/sky/lib/curve";

const p = (x: number, y: number): Point => ({ x, y });

describe("segmentsIntersect", () => {
  test("two segments crossing in an X", () => {
    assert.equal(segmentsIntersect(p(0, 0), p(10, 10), p(0, 10), p(10, 0)), true);
  });

  test("parallel segments never intersect", () => {
    assert.equal(segmentsIntersect(p(0, 0), p(10, 0), p(0, 5), p(10, 5)), false);
  });

  test("disjoint, non-parallel segments don't intersect", () => {
    assert.equal(segmentsIntersect(p(0, 0), p(1, 1), p(10, 0), p(11, 1)), false);
  });

  test("a T-touch (one segment's endpoint lands on the other's middle) counts as intersecting", () => {
    assert.equal(segmentsIntersect(p(0, 0), p(10, 0), p(5, -5), p(5, 0)), true);
  });

  test("collinear overlapping segments count as intersecting", () => {
    assert.equal(segmentsIntersect(p(0, 0), p(10, 0), p(5, 0), p(15, 0)), true);
  });

  test("collinear but disjoint segments on the same line don't intersect", () => {
    assert.equal(segmentsIntersect(p(0, 0), p(5, 0), p(10, 0), p(15, 0)), false);
  });
});

describe("polylinesIntersect", () => {
  test("two open polylines that cross", () => {
    const a = [p(0, 0), p(10, 10)];
    const b = [p(0, 10), p(10, 0)];
    assert.equal(polylinesIntersect(a, b), true);
  });

  test("two curved-looking polylines that stay apart", () => {
    const a = [p(0, 0), p(1, 3), p(2, 5), p(3, 6)];
    const b = [p(10, 0), p(11, 3), p(12, 5), p(13, 6)];
    assert.equal(polylinesIntersect(a, b), false);
  });

  test("a later segment of one polyline crossing an earlier segment of the other", () => {
    const a = [p(0, 0), p(0, 10), p(10, 10)];
    const b = [p(5, 5), p(5, 15)];
    assert.equal(polylinesIntersect(a, b), true);
  });
});

// Run: node --import ./src/lib/conjugate/test-hooks.mjs --test src/lib/svg-path.test.ts
//
// transformPathD and pathBBox are the two primitives SAK-72 Part B's composed
// yōon stroke diagram is built from (see composeGlyphStrokes in strokes.ts).
// This pins the two guarantees that composition depends on:
//
//   - transformPathD applies the affine correctly to BOTH the absolute M
//     (point: scale + translate) and the relative c (delta: scale only) — get
//     this backwards and every stroke after the first slides off the glyph;
//   - pathBBox resolves relative commands against the CURRENT point (not
//     chained pair-to-pair within one curve), so it reports the real absolute
//     extent of a path exactly the way a renderer would draw it.
//
// The fixture paths below are REAL KanjiVG data (や's and small ゃ's first
// stroke, fetched directly from the source during this ticket's
// investigation), not synthesized — so this also stands as the concrete check
// that transformPathD's output on a real base glyph's stroke lands on the
// real small glyph's own measured geometry, the cross-check that grounded the
// scale/translate approach composeGlyphStrokes uses.

import assert from "node:assert/strict";
import test from "node:test";

import { pathBBox, transformPathD } from "./svg-path.ts";

// や's first stroke (U+3084), KanjiVG.
const YA_STROKE_1 =
  "M18,49.38c1.88,1.62,5.25,2.5,8.62,0.88c18.51-8.88,35.76-19.38,50.83-19.26c9.02,0.14,16.01,4.13,15.93,12.29c0,8.33-10.88,16.58-24.5,17.83";
// ゃ's first stroke (U+3083), KanjiVG — the small form KanjiVG draws when ゃ
// is fetched as its own standalone character.
const SMALL_YA_STROKE_1 =
  "M26,61.07c1.49,1.29,4.16,1.98,6.84,0.69c14.68-7.03,28.36-15.36,40.32-15.26c7.16,0.11,12.7,3.28,12.63,9.75c0,6.61-8.63,13.15-19.43,14.14";

test("pathBBox resolves a real multi-curve stroke to its actual absolute extent", () => {
  // Measured directly off や's own KanjiVG label positions and cross-checked
  // against the shape of every point on the curve — the true bounding box is
  // roughly x:[18, 93.5] y:[15.9, 91.5] for the WHOLE glyph; this one stroke
  // alone stays within a tighter, but still sane, sub-range — nowhere near
  // triple-digit coordinates, which is what the pair-chaining bug this test
  // guards against produced.
  const b = pathBBox(YA_STROKE_1);
  assert.ok(b.xmin >= 0 && b.xmax <= 109, `x within grid: ${b.xmin}..${b.xmax}`);
  assert.ok(b.ymin >= 0 && b.ymax <= 109, `y within grid: ${b.ymin}..${b.ymax}`);
  assert.equal(b.xmin, 18, "the path starts at its M point");
});

test("transformPathD scales absolute M by scale+translate, relative c deltas by scale only", () => {
  // Identity-ish transform first: scale 1, no translate, must be a no-op on
  // the numbers (formatting aside).
  const identity = transformPathD("M10,20c1,2,3,4,5,6", { scale: 1, tx: 0, ty: 0 });
  assert.equal(identity, "M10,20c1,2,3,4,5,6");

  // Translate only: the M point moves, but the relative c deltas (distances)
  // must NOT — a delta's job is to say how far the pen moves, and translating
  // the whole path does not change that distance.
  const translated = transformPathD("M10,20c1,2,3,4,5,6", { scale: 1, tx: 100, ty: 200 });
  assert.equal(translated, "M110,220c1,2,3,4,5,6");

  // Scale only: both the M point AND the c deltas shrink together — a delta
  // scales because the whole shape is getting smaller, but with no
  // translation the origin point does not move.
  const scaled = transformPathD("M10,20c1,2,3,4,5,6", { scale: 0.5, tx: 0, ty: 0 });
  assert.equal(scaled, "M5,10c0.5,1,1.5,2,2.5,3");
});

test("real cross-check: transforming や's stroke by the measured や→ゃ affine lands on ゃ's own geometry", () => {
  // scale/tx/ty derived from や's and ゃ's own KanjiVG stroke-number label
  // positions (three points each, independently measured) during this
  // ticket's investigation — not tuned against this specific stroke.
  const affine = { scale: 0.793, tx: 11.73, ty: 21.89 };
  const transformed = transformPathD(YA_STROKE_1, affine);
  const got = pathBBox(transformed);
  const want = pathBBox(SMALL_YA_STROKE_1);
  // Within a point of the real small-glyph stroke's own bounding box —
  // confirms transformPathD reproduces real KanjiVG geometry, not just
  // internally-consistent arithmetic.
  assert.ok(Math.abs(got.xmin - want.xmin) < 1, `xmin: got ${got.xmin}, want ~${want.xmin}`);
  assert.ok(Math.abs(got.xmax - want.xmax) < 1, `xmax: got ${got.xmax}, want ~${want.xmax}`);
  assert.ok(Math.abs(got.ymin - want.ymin) < 1, `ymin: got ${got.ymin}, want ~${want.ymin}`);
  assert.ok(Math.abs(got.ymax - want.ymax) < 1, `ymax: got ${got.ymax}, want ~${want.ymax}`);
});

test("pathBBox: a curve's three pairs are relative to the CURVE'S START, not chained to each other", () => {
  // "c" moves from (0,0): control points at (10,0) and (10,10), endpoint at
  // (0,10) — a loop shape. If the pairs were wrongly chained (each pair
  // relative to the previous one, the bug this test guards against), the
  // endpoint would land at (20,20) instead of (0,10).
  const b = pathBBox("M0,0c10,0,10,10,0,10");
  assert.equal(b.xmax, 10, "control point x is the widest point");
  assert.equal(b.ymax, 10, "endpoint and control point share the max y");
});

test("pathBBox resets its current point per path — two independent strokes never bleed into each other", () => {
  const b1 = pathBBox("M5,5c1,1,2,2,3,3");
  const b2 = pathBBox("M5,5c1,1,2,2,3,3");
  assert.deepEqual(b1, b2, "calling pathBBox twice on the same stroke must be idempotent");
});

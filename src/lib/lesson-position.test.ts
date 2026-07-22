// Run: node --import ./src/lib/conjugate/test-hooks.mjs --test src/lib/lesson-position.test.ts
//
// positionLabel renders "where am I" on every lesson card. The rules it settles:
// a single item is not a degenerate range, a range uses an EN DASH, numbers get
// thousands separators, and a missing total prints NO denominator rather than
// an invented one (see the file header: a missing number beats a made-up one).

import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { positionLabel } from "@/lib/lesson-position";
import type { LessonPosition } from "@/lib/lesson-position";

const pos = (from: number, to: number, total: number | null): LessonPosition => ({
  from,
  to,
  total,
});

describe("positionLabel", () => {
  test("a single item is one number, not a from–to range", () => {
    assert.equal(positionLabel("kana", pos(5, 5, 46)), "kana 5 of 46");
  });

  test("a range joins with an en dash, not a hyphen", () => {
    const label = positionLabel("kanji", pos(5, 8, 2136));
    assert.ok(label.includes("5–8"), `expected en dash, got: ${label}`);
    assert.ok(!label.includes("5-8"), "must not use a hyphen for a numeric range");
  });

  test("thousands get a separator, so 'of 2,136' reads as a quantity", () => {
    assert.equal(positionLabel("kanji", pos(5, 8, 2136)), "kanji 5–8 of 2,136");
  });

  test("a null total prints no denominator at all", () => {
    assert.equal(positionLabel("patterns", pos(1, 1, null)), "patterns 1");
    assert.equal(positionLabel("patterns", pos(1, 3, null)), "patterns 1–3");
  });

  test("the noun is passed through verbatim — grammar says 'patterns', not 'lessons'", () => {
    assert.ok(positionLabel("patterns", pos(2, 2, 10)).startsWith("patterns "));
  });
});

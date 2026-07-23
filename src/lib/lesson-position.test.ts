// Run: node --import ./src/lib/conjugate/test-hooks.mjs --test src/lib/lesson-position.test.ts
//
// positionLabel renders "where am I" on every lesson card. The rules it settles:
// a single item is not a degenerate range, a range uses an EN DASH, numbers get
// thousands separators, and a missing total prints NO denominator rather than
// an invented one (see the file header: a missing number beats a made-up one).

import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { compositePositionLabel, positionLabel } from "@/lib/lesson-position";
import type { CompositePosition, LessonPosition } from "@/lib/lesson-position";

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

// The curriculum card teaches radicals, kanji and words in one lesson, so its
// label carries one segment per kind on the card. The rules positionLabel
// settles are unchanged inside each segment; what these pin is which segments
// appear, in what order, and how they are joined.
const composite = (
  radical: LessonPosition | null,
  kanji: LessonPosition | null,
  word: LessonPosition | null,
): CompositePosition => ({ radical, kanji, word });

describe("compositePositionLabel", () => {
  test("all three kinds read radical, then kanji, then word", () => {
    assert.equal(
      compositePositionLabel(composite(pos(3, 4, 90), pos(5, 8, 2136), pos(12, 12, 6213))),
      "Radical 3–4 of 90 · Kanji 5–8 of 2,136 · Word 12 of 6,213",
    );
  });

  test("a kind the lesson does not teach prints no segment at all", () => {
    assert.equal(
      compositePositionLabel(composite(null, null, pos(12, 12, 6213))),
      "Word 12 of 6,213",
    );
    assert.equal(
      compositePositionLabel(composite(pos(1, 2, 90), pos(1, 1, 2136), null)),
      "Radical 1–2 of 90 · Kanji 1 of 2,136",
    );
  });

  test("the order is fixed, whatever order the fields were filled in", () => {
    // It is the order the material arrives in inside the lesson: a component
    // before what it builds, a kanji before the word written with it.
    const label = compositePositionLabel(
      composite(pos(1, 1, 90), pos(1, 1, 2136), pos(1, 1, 6213)),
    );
    assert.ok(label.indexOf("Radical") < label.indexOf("Kanji"));
    assert.ok(label.indexOf("Kanji") < label.indexOf("Word"));
  });

  test("segments join with a middot, and keep positionLabel's own rules", () => {
    const label = compositePositionLabel(composite(null, pos(5, 8, 2136), pos(1, 1, 6213)));
    assert.deepEqual(label.split(" · "), ["Kanji 5–8 of 2,136", "Word 1 of 6,213"]);
  });
});

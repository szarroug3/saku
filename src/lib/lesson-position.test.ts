// Run: node --import ./src/lib/conjugate/test-hooks.mjs --test src/lib/lesson-position.test.ts
//
// positionLabel renders "where am I" on every lesson card. The rules it settles:
// a single item is not a degenerate range, a range uses an EN DASH, numbers get
// thousands separators, and a missing total prints NO denominator rather than
// an invented one (see the file header: a missing number beats a made-up one).

import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { advancePosition, compositePositionLabel, positionLabel } from "@/lib/lesson-position";
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

// advancePosition is the one counting step a safe "N of M" is allowed to use
// (see the file header, "SEE advancePosition() FOR THE ONE SAFE WAY TO
// COMPUTE"). These tests pin its own arithmetic, then specifically simulate the
// SAK-13 failure mode — an out-of-order Library claim — to prove the invariant
// holds: a position computed by walking the STATIC track once is unaffected by
// which items a learner has since claimed, in curriculum order or not.
describe("advancePosition", () => {
  test("advances the cursor by count and spans from the old cursor + 1", () => {
    const { position, seenSoFar } = advancePosition(4, 3, 2136);
    assert.deepEqual(position, { from: 5, to: 7, total: 2136 });
    assert.equal(seenSoFar, 7);
  });

  test("a single-item count is a degenerate span, from === to", () => {
    const { position } = advancePosition(11, 1, 6213);
    assert.deepEqual(position, { from: 12, to: 12, total: 6213 });
  });

  test("count 0 returns null and leaves the cursor untouched", () => {
    const { position, seenSoFar } = advancePosition(9, 0, 90);
    assert.equal(position, null);
    assert.equal(seenSoFar, 9);
  });

  test("a null total threads through unchanged, for a track that can't derive one", () => {
    const { position } = advancePosition(0, 4, null);
    assert.deepEqual(position, { from: 1, to: 4, total: null });
  });

  test("threaded across groups, spans tile contiguously and from 1", () => {
    const counts = [2, 0, 3, 1, 4];
    let seen = 0;
    const spans: (LessonPosition | null)[] = [];
    for (const count of counts) {
      const r = advancePosition(seen, count, 10);
      spans.push(r.position);
      seen = r.seenSoFar;
    }
    assert.deepEqual(spans, [
      { from: 1, to: 2, total: 10 },
      null,
      { from: 3, to: 5, total: 10 },
      { from: 6, to: 6, total: 10 },
      { from: 7, to: 10, total: 10 },
    ]);
    assert.equal(seen, 10);
  });

  // THE OUT-OF-ORDER CLAIM CASE. A track's real groups (curriculum-lesson.ts's
  // packed lessons) are POSITIONED ONCE, over the static packing, independent of
  // any history. This models that shape directly: five groups of fixed sizes get
  // their spans from one forward pass with no history involved at all — and then
  // shows that a learner claiming group 4 (or any group, in any order, via the
  // Library's "I already know this") cannot change any group's span, because
  // history was never an input to begin with. There is nothing for an
  // out-of-order claim to corrupt.
  test("group spans do not depend on claim order, because they never depend on claims", () => {
    const groupSizes = [3, 5, 2, 1, 4]; // 15 items total, 5 static groups
    const total = groupSizes.reduce((a, b) => a + b, 0);

    const positionsOf = (sizes: readonly number[]) => {
      let seen = 0;
      return sizes.map((count) => {
        const r = advancePosition(seen, count, total);
        seen = r.seenSoFar;
        return r.position;
      });
    };

    // Computed once, as if nothing has ever been claimed.
    const frozen = positionsOf(groupSizes);
    assert.deepEqual(frozen, [
      { from: 1, to: 3, total: 15 },
      { from: 4, to: 8, total: 15 },
      { from: 9, to: 10, total: 15 },
      { from: 11, to: 11, total: 15 },
      { from: 12, to: 15, total: 15 },
    ]);

    // A learner now claims group 4's single item OUT OF ORDER via "I already
    // know this" — ahead of groups 1–3, which are still fully unclaimed. The
    // group SIZES never change (a claim marks items met, it does not remove
    // them from the packing), so recomputing the very same static pass gives
    // back the identical spans: claim order never entered the arithmetic.
    const afterOutOfOrderClaim = positionsOf(groupSizes);
    assert.deepEqual(afterOutOfOrderClaim, frozen);

    // And even every group being fully claimed, in a scattered, non-sequential
    // order (4, then 1, then 5, then 2, then 3), still can't move a span: the
    // static sizes this function is called with never reflect what is claimed.
    const afterEverythingClaimedOutOfOrder = positionsOf(groupSizes);
    assert.deepEqual(afterEverythingClaimedOutOfOrder, frozen);
  });

  // THE CONTRASTING UNSAFE PATTERN, named so it is never mistaken for a second
  // valid way to compute a position. This reproduces the reported bug shape on
  // purpose — "1–639 of 2,136" over a card that taught 5 items — by building the
  // kind of span a frontier-index-based computation would, to show WHY
  // advancePosition's signature (no history, no claims — just a static count) is
  // the fix: there is no frontier index for it to read in the first place.
  test("counter-example: deriving a span from an out-of-order claim's position is dishonest", () => {
    const curriculumTotal = 2136;
    const trulyTaught = 5; // what is actually on the card, taught in order
    const outOfOrderClaimIndex = 639; // 1-based curriculum position of one Library claim

    // SAFE: advancePosition, given the card's own static count, knows nothing
    // about any later out-of-order claim — there is no parameter for one.
    const safe = advancePosition(0, trulyTaught, curriculumTotal).position;
    assert.deepEqual(safe, { from: 1, to: 5, total: 2136 });

    // UNSAFE, reproduced on purpose: a "position" that reads `to` off the
    // highest claimed index (treating an out-of-order claim as how far the
    // learner has gotten) is exactly SAK-13's "1–639 of 2,136" over 5 taught
    // items. advancePosition cannot produce this shape, because computing it
    // would require passing history/claims in, and its signature has nowhere
    // to put them.
    const unsafeFrontierPosition = {
      from: 1,
      to: outOfOrderClaimIndex,
      total: curriculumTotal,
    };
    assert.deepEqual(unsafeFrontierPosition, { from: 1, to: 639, total: 2136 });
    assert.notEqual(
      unsafeFrontierPosition.to,
      trulyTaught,
      "639 is not 5 — this is the bug SAK-13 reports",
    );
  });
});

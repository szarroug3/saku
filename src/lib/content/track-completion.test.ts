// Run: node --import ./src/lib/conjugate/test-hooks.mjs --test src/lib/content/track-completion.test.ts

import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { lessonSpanInTrack, trackCompletion } from "./track-completion.ts";
import { emptyHistory, applyClaims } from "@/lib/history-ops";
import type { CompletionUnit } from "./track-completion.ts";
import type { FactId } from "@/types";

const fact = (id: string): FactId => id as FactId;

/** A fixture of 5 distinct items, one of them (灯) taught across TWO units
 * (two readings), so a fully-met item requires every one of its units met. */
const UNITS: CompletionUnit[] = [
  { item: { entry: "a" as never }, facts: [fact("a:meaning")] },
  { item: { entry: "b" as never }, facts: [fact("b:meaning")] },
  { item: { entry: "c" as never }, facts: [fact("c:meaning")] },
  // 灯-style: one item, two units (two readings), each with its own fact.
  { item: { entry: "d" as never }, facts: [fact("d:reading1")] },
  { item: { entry: "d" as never }, facts: [fact("d:reading2")] },
  { item: { entry: "e" as never }, facts: [fact("e:meaning")] },
];

describe("trackCompletion", () => {
  test("total is the distinct-item count, not the unit count", () => {
    const { total } = trackCompletion(UNITS, emptyHistory());
    assert.equal(total, 5, "a/b/c/d/e — 6 units fold to 5 items");
  });

  test("nothing met yields known 0", () => {
    const { known, total } = trackCompletion(UNITS, emptyHistory());
    assert.equal(known, 0);
    assert.equal(total, 5);
  });

  test("a single-unit item counts as known once its one fact is met", () => {
    const history = applyClaims(emptyHistory(), [fact("a:meaning")], 1);
    const { known } = trackCompletion(UNITS, history);
    assert.equal(known, 1);
  });

  test("a multi-unit item (two readings) counts as known only when BOTH units are met", () => {
    const halfway = applyClaims(emptyHistory(), [fact("d:reading1")], 1);
    assert.equal(trackCompletion(UNITS, halfway).known, 0, "one of two readings is not the item");

    const both = applyClaims(halfway, [fact("d:reading2")], 2);
    assert.equal(trackCompletion(UNITS, both).known, 1, "both readings met — the item is known");
  });

  test("known never exceeds total", () => {
    const everything = applyClaims(
      emptyHistory(),
      UNITS.flatMap((u) => u.facts),
      1,
    );
    const { known, total } = trackCompletion(UNITS, everything);
    assert.equal(known, total);
    assert.equal(known, 5);
  });

  test("an empty track yields 0 of 0", () => {
    assert.deepEqual(trackCompletion([], emptyHistory()), { known: 0, total: 0 });
  });

  // THE SAK-13 REGRESSION CHECK, at this file's own layer. See lesson-
  // position.test.ts's "counter-example: deriving a span from an out-of-order
  // claim's position is dishonest" for the failure this guards against upstream
  // — a SPAN read off an out-of-order claim's frontier index. A completion
  // count has no span, no frontier index, and no history-filtered remainder to
  // rebuild anything from: `total` is a property of `units` alone (never
  // recomputed from what's left), and `known` only ever counts entries that are
  // ACTUALLY, individually met — so an out-of-order claim can only ever move
  // `known` by exactly the items it touches, never inflate it into a number
  // that describes material nobody claimed, and never move `total` at all.
  describe("out-of-order Library claims never corrupt the tally (SAK-13)", () => {
    test("claiming the LAST item first (maximally out of order) reports 1 of 5, not a blown-up range", () => {
      const history = applyClaims(emptyHistory(), [fact("e:meaning")], 1);
      const result = trackCompletion(UNITS, history);
      assert.deepEqual(result, { known: 1, total: 5 });
    });

    test("scattered out-of-order claims (first, then last, nothing between) tally exactly what was claimed", () => {
      const history = applyClaims(
        emptyHistory(),
        [fact("a:meaning"), fact("e:meaning")],
        1,
      );
      assert.deepEqual(trackCompletion(UNITS, history), { known: 2, total: 5 });
    });

    test("total is identical whether nothing, some, or everything has been claimed", () => {
      const none = trackCompletion(UNITS, emptyHistory()).total;
      const some = trackCompletion(
        UNITS,
        applyClaims(emptyHistory(), [fact("c:meaning")], 1),
      ).total;
      const all = trackCompletion(
        UNITS,
        applyClaims(emptyHistory(), UNITS.flatMap((u) => u.facts), 1),
      ).total;
      assert.equal(none, 5);
      assert.equal(some, 5);
      assert.equal(all, 5);
    });
  });
});

// lessonSpanInTrack — the SAFE per-lesson span (see this file's own header,
// "THE LESSON'S OWN SPAN"). It reads a lesson's units' RANK in the track's own
// static `order`, never a count derived from history, so — unlike a naive
// `from = known + 1` — an out-of-order Library claim or a far-flung prerequisite
// pull can widen the span (see the last two tests) but can never make it lie:
// it always reports exactly the rank window the units on the card occupy.
describe("lessonSpanInTrack", () => {
  /** A track shaped like kana/grammar/etc.: `n` distinct items, ranked by their
   * position in the array — exactly what `order` is for every live track. */
  const trackOf = (n: number): CompletionUnit[] =>
    Array.from({ length: n }, (_, i) => ({
      item: { entry: `item-${i + 1}` as never },
      facts: [fact(`item-${i + 1}:fact`)],
    }));

  // (a) THE ORDINARY CASE — matches the worked example from the bug report
  // exactly: the first kana lesson, five items, nothing known yet, reads
  // "1–5 of 46" rather than the old code's bare "0".
  test("the first lesson's own units rank 1..K — the worked example ('1-5 of N')", () => {
    const order = trackOf(46);
    const lessonUnits = order.slice(0, 5); // the scheduler's first 5-item lesson
    assert.deepEqual(lessonSpanInTrack(order, lessonUnits), { from: 1, to: 5 });
  });

  test("a later, still in-order lesson ranks contiguously from wherever it starts", () => {
    const order = trackOf(46);
    const lessonUnits = order.slice(20, 25); // ranks 21-25
    assert.deepEqual(lessonSpanInTrack(order, lessonUnits), { from: 21, to: 25 });
  });

  test("a single-unit lesson is a degenerate span, from === to", () => {
    const order = trackOf(19);
    assert.deepEqual(lessonSpanInTrack(order, [order[6]]), { from: 7, to: 7 });
  });

  // (b) THE COUNTER-EXAMPLE, mirroring lesson-position.test.ts's own
  // "counter-example" test: prove this function does NOT reproduce the
  // "1–639 of 2,136" shape for a plain in-order lesson just because an
  // out-of-order Library claim exists SOMEWHERE ELSE in the track.
  // `lessonSpanInTrack` takes no history/claims parameter at all — there is
  // nothing here for a claim to read, let alone distort — so this pins that
  // invariant directly rather than only arguing it in prose.
  test("counter-example: an out-of-order claim elsewhere in the track cannot widen this lesson's span", () => {
    const order = trackOf(2136);
    // A learner claimed item 639 (0-based index 638) out of order via the
    // Library. That claim lives entirely upstream, in history — it never
    // reaches this function. What is ACTUALLY taught this lesson is the plain
    // next 5 native items, ranks 1-5.
    const lessonUnits = order.slice(0, 5);
    const span = lessonSpanInTrack(order, lessonUnits);
    assert.deepEqual(span, { from: 1, to: 5 });
    assert.notEqual(span?.to, 639, "639 must not leak in — this is the bug SAK-13 reports, relocated");
  });

  // A unit the scheduler pulled in from ANOTHER track's own order (see this
  // file's header: a counter lesson's kanji prerequisite resolves through
  // vocab's pronunciation units, not the counters track's own order) has no
  // rank here at all — excluded, not reported as an unknown position.
  test("a unit foreign to this track's own order is excluded, not reported as an unknown position", () => {
    const order = trackOf(10);
    const foreign: CompletionUnit = { item: { entry: "other-track:kanji" as never }, facts: [] };
    const lessonUnits = [foreign, order[2]]; // foreign prereq bundled with a native due unit (rank 3)
    assert.deepEqual(lessonSpanInTrack(order, lessonUnits), { from: 3, to: 3 });
  });

  test("null when none of the lesson's units are native to this track's order", () => {
    const order = trackOf(5);
    const foreign: CompletionUnit = { item: { entry: "other-track:x" as never }, facts: [] };
    assert.equal(lessonSpanInTrack(order, [foreign]), null);
  });

  // (c) A SYNTHETIC OUT-OF-ORDER-CLAIM + PREREQ-PULL SCENARIO — the shape
  // unit-scheduler-core.ts's planUnitLessonCore actually produces for a track
  // like vocab or numbers/counters, and CONFIRMED EMPIRICALLY for the real
  // vocab track by simulating its first 60 lessons from empty history (no
  // claims at all, in-order, default scheduling): spans like "13-3301 of
  // 14,182" and "155-8189 of 14,182" appear from lesson 3 onward — this is not
  // a rare edge case for vocab, it is the common shape past the first couple of
  // lessons, because vocab's `order` is frequency-ranked while a word's
  // kanji-component prerequisite resolves by curriculum Built-from edges (see
  // vocabPositionLabel's comment in home-feed.tsx).
  //
  // Modeled here directly: the due unit sits at a low rank; its untaught
  // prerequisite (bundled FIRST, per planUnitLessonCore's "prereqs first" —
  // unit-scheduler-core.ts's own comment) sits far later in this SAME `order`.
  // No history or out-of-order claim is even needed to trigger this shape (an
  // out-of-order claim can only make it MORE likely, by leaving exactly the
  // item whose prereq is far away as the next due one) — it falls straight out
  // of prereqChain reaching across `order` for an untaught component. The
  // resulting span is wide, but it is NOT a lie: it is exactly the rank window
  // the two units the card is actually teaching occupy — see
  // lessonSpanInTrack's own comment for why the width itself isn't a bug.
  test("a prerequisite pulled from far away in the same order produces a wide, truthful span — not a bug", () => {
    const order = trackOf(2136);
    const prereq = order[1899]; // untaught component, rank 1900
    const due = order[4]; // the due unit that needed it, rank 5
    const lessonUnits = [prereq, due]; // chain-then-unit, as the scheduler emits it
    assert.deepEqual(lessonSpanInTrack(order, lessonUnits), { from: 5, to: 1900 });
  });
});

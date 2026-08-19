// Run: node --import ./src/lib/conjugate/test-hooks.mjs --test src/lib/content/track-completion.test.ts

import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { trackCompletion } from "./track-completion.ts";
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

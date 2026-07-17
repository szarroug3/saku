// Run: node --import ./src/lib/conjugate/test-hooks.mjs --test src/components/session/retry-grouping.test.ts
//
// retry-grouping.ts is pure — it takes a standing lookup, not a history — so it
// loads here as itself with no clock and no React. What it pins is the two
// rules the round-complete picker is easy to get subtly wrong on: the bands
// come out worst-first (and only the non-empty ones), and opening the picker
// pre-ticks exactly your misses.

import assert from "node:assert/strict";
import { test } from "node:test";

import type { Standing } from "@/lib/library/standing";
import type { FactId } from "@/types";

import {
  RETRY_STANDING_ORDER,
  groupByStanding,
  initialPicked,
} from "./retry-grouping";

const f = (s: string): FactId => s as FactId;

test("groups worst-first and drops empty bands", () => {
  // Deliberately handed in a scrambled order; the output order is the ranking's.
  const standing: Record<string, Standing> = {
    a: "solid",
    b: "shaky",
    c: "not-seen",
    d: "getting-there",
  };
  const groups = groupByStanding(
    [f("a"), f("b"), f("c"), f("d")],
    (x) => standing[x as string],
  );

  assert.deepEqual(
    groups.map((g) => g.standing),
    ["shaky", "getting-there", "solid", "not-seen"],
  );
  // No empty "slipping" / "claimed" bands leak in.
  assert.equal(groups.length, 4);
});

test("keeps the caller's order within a band", () => {
  // The misses arrive most-missed-first; bucketing must not reshuffle them.
  const groups = groupByStanding(
    [f("z"), f("y"), f("x")],
    () => "shaky",
  );
  assert.equal(groups.length, 1);
  assert.deepEqual(groups[0].facts, [f("z"), f("y"), f("x")]);
});

test("RETRY_STANDING_ORDER is worst-first and total over the standings", () => {
  assert.deepEqual(RETRY_STANDING_ORDER, [
    "shaky",
    "slipping",
    "getting-there",
    "solid",
    "claimed",
    "not-seen",
  ]);
});

test("initialPicked ticks exactly the misses, nothing else", () => {
  const picked = initialPicked([f("し"), f("つ")]);
  assert.equal(picked["し"], true);
  assert.equal(picked["つ"], true);
  // A fact that wasn't missed is absent (falsy), not pre-checked.
  assert.equal(picked["か"], undefined);
  assert.equal(Object.keys(picked).length, 2);
});

test("initialPicked on a clean round selects nothing", () => {
  assert.deepEqual(initialPicked([]), {});
});

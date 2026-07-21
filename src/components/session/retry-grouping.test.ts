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
  retryHint,
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

// ---------- retryHint ----------
//
// The four states of the line above the picker. Two of them are new, and they
// exist because a tester finished a perfect retry and was handed back a screen
// that said nothing about it: "My perfect retry round left no trace."

test("retryHint names what the retry got back, and what is left", () => {
  // Two missed, both recovered on the retry: nothing left to offer, and the
  // line says the retry went clean.
  assert.equal(
    retryHint(0, 2),
    "You got all 2 back. Nothing left over, but pick anything you want another look at.",
  );
  // One missed, recovered.
  assert.equal(
    retryHint(0, 1),
    "You got it back. Nothing left over, but pick anything you want another look at.",
  );
  // Partial: credit for what landed, the rest still ticked.
  assert.equal(retryHint(1, 2), "You got all 2 back. The other 1 is picked.");
  assert.equal(retryHint(3, 1), "You got it back. The other 3 are picked.");
});

test("retryHint is unchanged where nothing has been recovered yet", () => {
  assert.equal(
    retryHint(2, 0),
    "Your 2 misses are picked. Add or drop anything.",
  );
  assert.equal(
    retryHint(1, 0),
    "Your 1 miss is picked. Add or drop anything.",
  );
  assert.equal(
    retryHint(0, 0),
    "Nothing missed. Pick anything you want another look at.",
  );
});

test("retryHint before and after a perfect retry are different sentences", () => {
  // The requirement, stated as an assertion: a perfect retry must not leave
  // the screen saying what it said before.
  assert.notEqual(retryHint(2, 0), retryHint(0, 2));
});

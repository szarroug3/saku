// Run: node --import ./src/lib/conjugate/test-hooks.mjs --test src/lib/session.test.ts
//
// Uses node:test + native TypeScript stripping (Node 24). session.ts is pure —
// it imports only facts (a data module) and types — so it loads here as itself.
//
// WHAT THIS PINS
// ==============
// The round-complete screen reads from TWO sources on purpose, and a regression
// once collapsed them into one: the "Pick what to retry" list was built from
// the ANSWERED set (roundStats) instead of the full drill (session.facts), so
// ending a round early — answered 1 of 9 — offered only that 1 to retry.
//
// `roundCompleteView` is the split, made testable. These tests assert the
// distinction directly: the picker's `selection` is the whole `session.facts`
// regardless of how few you answered, while the header counts (`total`,
// `firstTry`) and `missed` come only from what was actually answered.

import assert from "node:assert/strict";
import { test } from "node:test";

import { roundCompleteView, type StudySession } from "@/lib/session";
import type { FactId, FactSessionDetail } from "@/types";

const f = (s: string): FactId => s as FactId;

/** A FactSessionDetail with the two fields these tests care about set, the
 * rest at their empty defaults. */
function detail(over: Partial<FactSessionDetail> = {}): FactSessionDetail {
  return {
    seen: 1,
    misses: 0,
    everCorrect: true,
    firstTryCorrect: null,
    correct: 0,
    slow: 0,
    confused: {},
    ...over,
  };
}

/** A StudySession where only `facts` (the full selection) and `roundStats`
 * (what was answered) matter — those are the two fields the view reads. The
 * cast is honest about that: nothing else is exercised. */
function sessionWith(
  facts: FactId[],
  roundStats: Record<string, FactSessionDetail>,
): StudySession {
  return { facts, roundStats } as unknown as StudySession;
}

test("picker offers the FULL selection even when almost nothing was answered", () => {
  // A 9-word lesson; the round was ended after answering exactly one.
  const nine = ["a", "b", "c", "d", "e", "f", "g", "h", "i"].map(f);
  const view = roundCompleteView(
    sessionWith(nine, { a: detail({ firstTryCorrect: true, correct: 1 }) }),
  );

  // The bug: this used to be `["a"]`. The picker must offer all nine.
  assert.deepEqual(view.selection, nine);
  assert.equal(view.selection.length, 9);
  // And every planned fact is pickable, including the eight never reached.
  for (const g of nine) assert.ok(view.selection.includes(g));
});

test("header counts derive from what was ANSWERED, not the full selection", () => {
  const nine = ["a", "b", "c", "d", "e", "f", "g", "h", "i"].map(f);
  const view = roundCompleteView(
    sessionWith(nine, { a: detail({ firstTryCorrect: true, correct: 1 }) }),
  );

  // "1 question · 1 right first try · 0 missed" — honest about the round played,
  // NOT inflated to the nine that were planned.
  assert.equal(view.total, 1);
  assert.equal(view.firstTry, 1);
  assert.equal(view.missed.length, 0);
  assert.deepEqual(view.answered, [f("a")]);
});

test("the two sources are independent: full selection, partial answered, real miss", () => {
  const three = ["x", "y", "z"].map(f);
  const view = roundCompleteView(
    sessionWith(three, {
      x: detail({ firstTryCorrect: false, misses: 2, everCorrect: true }),
      y: detail({ firstTryCorrect: true, correct: 1 }),
    }),
  );

  // Picker: all three, in selection order.
  assert.deepEqual(view.selection, three);
  // Summary: only the two answered; one first-try; one miss (x).
  assert.equal(view.total, 2);
  assert.equal(view.firstTry, 1);
  assert.deepEqual(view.missed, [f("x")]);
  // The never-reached fact (z) is in the picker but not in any summary count.
  assert.ok(view.selection.includes(f("z")));
  assert.ok(!view.answered.includes(f("z")));
  assert.ok(!view.missed.includes(f("z")));
});

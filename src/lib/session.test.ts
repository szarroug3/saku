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

import { mergeStats, roundCompleteView, type StudySession } from "@/lib/session";
import type { FactId, FactSessionDetail, SessionStats } from "@/types";

const f = (s: string): FactId => s as FactId;

/** A FactSessionDetail with the two fields these tests care about set, the
 * rest at their empty defaults. */
function detail(over: Partial<FactSessionDetail> = {}): FactSessionDetail {
  return {
    seen: 1,
    misses: 0,
    everCorrect: true,
    firstTryCorrect: null,
    firstTryCount: 0,
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

// ---------- mergeStats ----------
//
// This function had ZERO tests, while its own docstring called the number it
// merges "the one number in the app that has to stay honest". The two
// first-try fields are merged by DIFFERENT rules on purpose and that pair is
// exactly what needs pinning:
//
//   firstTryCorrect — a FLAG about the first showing. Never overwritten once
//                     set, so round three cannot rewrite how you did cold in
//                     round one.
//   firstTryCount   — a COUNT of showings that earned the credit. Sums, like
//                     every other count, because the showings all happened.
//
// It is the count that the accuracy pill divides by `seen`, so if it stops
// being additive (or stops being a count) the ratio silently changes units
// again — which is the bug this whole change exists to fix.

test("mergeStats sums firstTryCount and leaves the flag alone", () => {
  const a = { [f("a")]: detail({ seen: 2, firstTryCorrect: true, firstTryCount: 2, correct: 2 }) };
  const b = { [f("a")]: detail({ seen: 3, firstTryCorrect: false, firstTryCount: 1, correct: 3 }) };
  const out = mergeStats(a, b);

  assert.equal(out[f("a")].seen, 5);
  assert.equal(out[f("a")].firstTryCount, 3, "the count is additive");
  assert.equal(out[f("a")].firstTryCorrect, true, "the flag is NOT overwritten");
});

test("mergeStats keeps firstTryCount <= seen", () => {
  // The invariant the accuracy pill depends on: a ratio over 100% is a unit
  // error, and this is where the two numbers meet.
  const legs: SessionStats[] = [
    { [f("a")]: detail({ seen: 4, firstTryCount: 3, correct: 4 }) },
    { [f("a")]: detail({ seen: 1, firstTryCount: 1, correct: 1 }) },
    { [f("a")]: detail({ seen: 6, firstTryCount: 0, correct: 2, misses: 6 }) },
  ];
  const out = legs.reduce((acc, leg) => mergeStats(acc, leg), {} as SessionStats);

  assert.equal(out[f("a")].seen, 11);
  assert.equal(out[f("a")].firstTryCount, 4);
  assert.ok(out[f("a")].firstTryCount <= out[f("a")].seen, "numerator never exceeds denominator");
});

test("mergeStats is commutative in every count", () => {
  // Retry legs and rounds arrive in whatever order the loop ran them. The
  // counts must not care — only the flag does, and it is tested separately.
  const a = { [f("a")]: detail({ seen: 2, firstTryCount: 2, correct: 2, misses: 1, slow: 1 }) };
  const b = { [f("a")]: detail({ seen: 5, firstTryCount: 1, correct: 4, misses: 3, slow: 0 }) };
  const ab = mergeStats(a, b)[f("a")];
  const ba = mergeStats(b, a)[f("a")];

  for (const k of ["seen", "firstTryCount", "correct", "misses", "slow"] as const) {
    assert.equal(ab[k], ba[k], `${k} is order-independent`);
  }
});

test("mergeStats is additive across many legs, in any grouping", () => {
  // Associativity as well: (a+b)+c === a+(b+c). Rounds are folded pairwise, so
  // a non-associative merge would give a different total for the same session.
  const a = { [f("a")]: detail({ seen: 1, firstTryCount: 1, correct: 1 }) };
  const b = { [f("a")]: detail({ seen: 2, firstTryCount: 1, correct: 2 }) };
  const c = { [f("a")]: detail({ seen: 4, firstTryCount: 3, correct: 4 }) };

  const left = mergeStats(mergeStats(a, b), c)[f("a")];
  const right = mergeStats(a, mergeStats(b, c))[f("a")];
  assert.equal(left.firstTryCount, 5);
  assert.equal(left.seen, 7);
  assert.equal(right.firstTryCount, left.firstTryCount);
  assert.equal(right.seen, left.seen);
});

test("mergeStats never produces NaN from a pre-firstTryCount snapshot", () => {
  // A stat restored from localStorage before the field existed has no
  // firstTryCount. `undefined + n` would be NaN, and it would spread from here
  // into every later merge and into the pill.
  const old = detail({ seen: 2, firstTryCorrect: true }) as Partial<FactSessionDetail>;
  delete old.firstTryCount;
  const stale: SessionStats = { [f("a")]: old as FactSessionDetail };
  const fresh = { [f("a")]: detail({ seen: 1, firstTryCount: 1, correct: 1 }) };

  // Old on the left (copied through) and on the right (folded in).
  const asInto = mergeStats(stale, fresh)[f("a")];
  const asFrom = mergeStats(fresh, stale)[f("a")];
  assert.equal(asInto.firstTryCount, 2, "derived 1 from the flag, plus the real 1");
  assert.equal(asFrom.firstTryCount, 2);
  assert.ok(!Number.isNaN(asInto.firstTryCount));
  assert.ok(!Number.isNaN(asFrom.firstTryCount));

  // Merging two legacy stats is still a number, and still bounded by seen.
  const both = mergeStats(stale, stale)[f("a")];
  assert.equal(both.firstTryCount, 2);
  assert.ok(both.firstTryCount <= both.seen);
});

test("mergeStats does not mutate its inputs", () => {
  // The loop merges the round into the total and keeps using the round.
  const a = { [f("a")]: detail({ seen: 1, firstTryCount: 1, correct: 1 }) };
  const b = { [f("a")]: detail({ seen: 3, firstTryCount: 2, correct: 3 }) };
  mergeStats(a, b);
  assert.equal(a[f("a")].firstTryCount, 1);
  assert.equal(a[f("a")].seen, 1);
  assert.equal(b[f("a")].firstTryCount, 2);
});

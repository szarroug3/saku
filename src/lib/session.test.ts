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

import {
  mergeStats,
  recoveredAfterLeg,
  roundCompleteView,
  type StudySession,
} from "@/lib/session";
import type { FactId, FactSessionDetail, SessionStats } from "@/types";

const f = (s: string): FactId => s as FactId;

/** A FactSessionDetail with the fields a test cares about set, the rest at
 * their empty defaults.
 *
 * `firstTryCount` is passed explicitly wherever it matters. It is the header's
 * numerator now (showings, not the flag), so a fixture that sets
 * `firstTryCorrect: true` and leaves the count at 0 describes a fact that was
 * right first try and yet has no first-try showing — which cannot happen, and
 * which quietly made the old header's units look fine. */
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

/** A SessionStats literal keyed by the short names these tests use. The real
 * type is keyed by the branded FactId, which a plain object literal will not
 * widen into; `sessionWith` already takes the loose shape, this is for the
 * calls that hand a leg straight to mergeStats/recoveredAfterLeg. */
function stats(o: Record<string, FactSessionDetail>): SessionStats {
  return o as unknown as SessionStats;
}

test("picker offers the FULL selection even when almost nothing was answered", () => {
  // A 9-word lesson; the round was ended after answering exactly one.
  const nine = ["a", "b", "c", "d", "e", "f", "g", "h", "i"].map(f);
  const view = roundCompleteView(
    sessionWith(nine, {
      a: detail({ firstTryCorrect: true, firstTryCount: 1, correct: 1 }),
    }),
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
    sessionWith(nine, {
      a: detail({ firstTryCorrect: true, firstTryCount: 1, correct: 1 }),
    }),
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
      y: detail({ firstTryCorrect: true, firstTryCount: 1, correct: 1 }),
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

// ---------- the header arithmetic ----------
//
// The line read "5 questions · 4 right first try · 2 missed" after a five-card
// lesson. Six from five, because the three numbers answered three different
// questions: unique facts, the per-round first-try FLAG, and missedInRound.
// They are all SHOWINGS now (task 03's ruling), and the third is a subtraction
// of the first two so the sentence cannot stop adding up.

/** The header's contract, asserted the way a reader does it: left to right. */
function assertSums(view: { total: number; firstTry: number; needAnother: number }) {
  assert.equal(
    view.firstTry + view.needAnother,
    view.total,
    `${view.total} questions · ${view.firstTry} right first try · ${view.needAnother} needed another look`,
  );
}

test("header counts SHOWINGS and sums to the stated total", () => {
  const five = ["a", "b", "c", "d", "e"].map(f);
  // Three landed cold. Two were missed and requeued, and landed on the requeue:
  // 7 showings, 5 of them first-try-correct, 2 that needed another look.
  const view = roundCompleteView(
    sessionWith(five, {
      a: detail({ seen: 1, firstTryCount: 1, firstTryCorrect: true, correct: 1 }),
      b: detail({ seen: 1, firstTryCount: 1, firstTryCorrect: true, correct: 1 }),
      c: detail({ seen: 1, firstTryCount: 1, firstTryCorrect: true, correct: 1 }),
      d: detail({ seen: 2, misses: 1, firstTryCount: 1, firstTryCorrect: false, correct: 1 }),
      e: detail({ seen: 2, misses: 1, firstTryCount: 1, firstTryCorrect: false, correct: 1 }),
    }),
  );

  assert.equal(view.total, 7);
  assert.equal(view.firstTry, 5);
  assert.equal(view.needAnother, 2);
  assertSums(view);
  // The historical record is untouched: those two really were missed.
  assert.deepEqual([...view.missed].sort(), [f("d"), f("e")]);
});

test("the arithmetic holds across the shapes a round can take", () => {
  const three = ["x", "y", "z"].map(f);
  const shapes: Array<Record<string, ReturnType<typeof detail>>> = [
    // Nothing answered at all.
    {},
    // A clean sweep.
    {
      x: detail({ seen: 1, firstTryCount: 1, firstTryCorrect: true, correct: 1 }),
      y: detail({ seen: 1, firstTryCount: 1, firstTryCorrect: true, correct: 1 }),
    },
    // Never landed: shown four times, missed every time.
    { x: detail({ seen: 4, misses: 4, firstTryCount: 0, everCorrect: false }) },
    // Missed then RECOVERED on a retry leg — the shape finding 2 was born in.
    { x: detail({ seen: 3, misses: 1, firstTryCount: 2, firstTryCorrect: false, correct: 2 }) },
    // Right, but only with a hint: seen and correct, no first-try credit.
    { y: detail({ seen: 1, misses: 0, firstTryCount: 0, correct: 1 }) },
    // A partially-played round: one of three reached.
    { z: detail({ seen: 2, misses: 1, firstTryCount: 1, correct: 1 }) },
  ];

  for (const stats of shapes) {
    const view = roundCompleteView(sessionWith(three, stats));
    assertSums(view);
    assert.ok(view.needAnother >= 0, "a count is never negative");
    assert.ok(view.firstTry <= view.total, "numerator never exceeds the total");
  }
});

test("header reads a pre-firstTryCount snapshot without inventing anything", () => {
  // A session resumed across the upgrade has no firstTryCount; firstTryShowings
  // derives it from the flag rather than defaulting to 0 and showing the round
  // at zero right. See src/lib/first-try.ts.
  const legacy = detail({ seen: 1, firstTryCorrect: true }) as Partial<FactSessionDetail>;
  delete legacy.firstTryCount;
  const view = roundCompleteView(
    sessionWith([f("a")], { a: legacy as FactSessionDetail }),
  );
  assert.equal(view.firstTry, 1);
  assertSums(view);
});

// ---------- a retry has to leave a trace ----------
//
// "My perfect retry round left no trace." Two misses, both retried, both right,
// and the identical screen came back: still 2 missed, still both ticked, still
// "Retry 2". The round's history is kept (you did miss them), but the OFFER now
// reflects what is still true.

test("a perfect retry changes the summary", () => {
  const two = ["d", "e"].map(f);
  const afterLeg1 = stats({
    d: detail({ seen: 1, misses: 1, firstTryCount: 0, firstTryCorrect: false, everCorrect: false }),
    e: detail({ seen: 1, misses: 1, firstTryCount: 0, firstTryCorrect: false, everCorrect: false }),
  });
  const before = roundCompleteView(sessionWith(two, afterLeg1));

  // The retry leg: both asked again, both landed clean.
  const leg2 = stats({
    d: detail({ seen: 1, misses: 0, firstTryCount: 1, everCorrect: true, correct: 1 }),
    e: detail({ seen: 1, misses: 0, firstTryCount: 1, everCorrect: true, correct: 1 }),
  });
  const session = sessionWith(two, mergeStats(afterLeg1, leg2));
  session.recovered = recoveredAfterLeg(before.recovered, leg2);
  const after = roundCompleteView(session);

  // THE REQUIREMENT: the two screens are not the same screen.
  assert.notDeepEqual(
    { t: before.total, ft: before.firstTry, out: before.outstanding },
    { t: after.total, ft: after.firstTry, out: after.outstanding },
  );
  // Nothing is offered for retry any more...
  assert.deepEqual(before.outstanding, [f("d"), f("e")]);
  assert.deepEqual(after.outstanding, []);
  // ...and the recovery is named rather than the misses being erased.
  assert.deepEqual([...after.recovered].sort(), [f("d"), f("e")]);
  assert.deepEqual([...after.missed].sort(), [f("d"), f("e")], "history is kept");
  // The counts moved too: two more questions, two more landed cold.
  assert.equal(before.total, 2);
  assert.equal(after.total, 4);
  assert.equal(before.firstTry, 0);
  assert.equal(after.firstTry, 2);
  assertSums(before);
  assertSums(after);
});

test("a retry that misses again stays outstanding", () => {
  const two = ["d", "e"].map(f);
  const leg1 = stats({
    d: detail({ seen: 1, misses: 1, firstTryCount: 0, everCorrect: false }),
    e: detail({ seen: 1, misses: 1, firstTryCount: 0, everCorrect: false }),
  });
  const leg2 = stats({
    d: detail({ seen: 1, misses: 0, firstTryCount: 1, everCorrect: true, correct: 1 }),
    e: detail({ seen: 2, misses: 1, firstTryCount: 0, everCorrect: true, correct: 1 }),
  });
  const session = sessionWith(two, mergeStats(leg1, leg2));
  session.recovered = recoveredAfterLeg([], leg2);
  const view = roundCompleteView(session);

  // e landed, but not cleanly. "You got it back" is a claim about a clean
  // showing, so e is still on offer.
  assert.deepEqual(view.recovered, [f("d")]);
  assert.deepEqual(view.outstanding, [f("e")]);
});

test("recoveredAfterLeg carries facts a later leg did not re-ask", () => {
  const [d, e] = ["d", "e"].map(f);
  const clean = detail({ seen: 1, misses: 0, firstTryCount: 1, everCorrect: true, correct: 1 });
  // Leg 2 clears both; leg 3 re-asks only d.
  const after2 = recoveredAfterLeg([], stats({ d: clean, e: clean }));
  assert.deepEqual([...after2].sort(), [d, e]);
  const after3 = recoveredAfterLeg(after2, stats({ d: clean }));
  assert.deepEqual([...after3].sort(), [d, e], "e keeps what it earned in leg 2");

  // But a leg that re-asks and re-misses takes it back.
  const after4 = recoveredAfterLeg(
    after3,
    stats({ d: detail({ seen: 1, misses: 1, firstTryCount: 0, everCorrect: false }) }),
  );
  assert.deepEqual(after4, [e]);
});

test("recoveredAfterLeg on the first leg cannot claim a recovery", () => {
  const three = ["x", "y", "z"].map(f);
  const leg1 = stats({
    x: detail({ seen: 1, misses: 0, firstTryCount: 1, everCorrect: true, correct: 1 }),
    y: detail({ seen: 2, misses: 1, firstTryCount: 1, firstTryCorrect: false, correct: 1 }),
  });
  const session = sessionWith(three, leg1);
  session.recovered = recoveredAfterLeg([], leg1);
  const view = roundCompleteView(session);

  // x is in the raw recovered set (it was clean), but it was never missed, so
  // the screen never calls it a recovery: recovered is read against `missed`.
  assert.deepEqual(view.recovered, []);
  assert.deepEqual(view.outstanding, [f("y")]);
});

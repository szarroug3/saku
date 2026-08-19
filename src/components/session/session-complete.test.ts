// Run: node --import ./src/lib/conjugate/test-hooks.mjs --test \
//        src/components/session/session-complete.test.ts
//
// SAK-21: "You finished on N correct, the same as you started" claimed no
// change had happened even when round 1 took a miss that got recovered
// before the round ended. `correct` is everCorrect, a monotonic OR over a
// round's retry legs (drill-stats.ts / RoundSummary) — a miss-then-recovery
// and a clean pass both land on `correct: total`, so comparing `correct`
// alone cannot tell them apart. `sameAsStarted` is the fix: it also checks
// `missed`, which the miss-then-recovery round carries and the clean one
// doesn't.

import assert from "node:assert/strict";
import { test } from "node:test";

import { sameAsStarted, type RoundSummary } from "@/lib/session";

function round(over: Partial<RoundSummary> = {}): RoundSummary {
  return { round: 1, total: 5, correct: 5, missed: 0, ...over };
}

test("a miss recovered within the round is NOT the same as a clean round", () => {
  // The reported scenario: round 1 misses one fact, then gets it back on a
  // retry leg before the round ends — `correct` folds the retry in, so it
  // reads identically to never having missed at all. `missed` still knows.
  const first = round({ round: 1, total: 5, correct: 5, missed: 1 });
  const last = round({ round: 3, total: 5, correct: 5, missed: 0 });
  assert.equal(sameAsStarted(first, last), false);
});

test("two genuinely identical rounds ARE the same", () => {
  const first = round({ round: 1, total: 5, correct: 4, missed: 1 });
  const last = round({ round: 3, total: 5, correct: 4, missed: 1 });
  assert.equal(sameAsStarted(first, last), true);
});

test("a different correct count is never the same, regardless of missed", () => {
  const first = round({ round: 1, total: 5, correct: 3, missed: 2 });
  const last = round({ round: 3, total: 5, correct: 5, missed: 0 });
  assert.equal(sameAsStarted(first, last), false);
});

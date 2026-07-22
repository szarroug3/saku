// Run: node --import ./src/lib/conjugate/test-hooks.mjs --test src/lib/claims.test.ts
//
// claims.ts decides what the model believes about a fact from what you SAID ("I
// know this" / "quiz me") as well as what you DID. effectiveState is the arbiter
// and its one rule is NEWEST RECORD WINS across three records, nothing merged.
// budget.test.ts touches a few cases in passing; this pins the rule directly and
// in every direction.

import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { CLAIMED_DAYS, claimedState, effectiveState, seenState } from "@/lib/claims";
import { SCORING, UNMET } from "@/lib/scoring";
import type { FactState } from "@/types";

const DAY = 86_400_000;

describe("claimedState / seenState — the state each assertion implies", () => {
  test("a claim is a season of stability, stamped at the claim time", () => {
    assert.deepEqual(claimedState(5_000), { stability: CLAIMED_DAYS, lastTested: 5_000 });
  });

  test("a 'quiz me' is only the floor stability — it decays straight back into rotation", () => {
    assert.deepEqual(seenState(5_000), { stability: SCORING.floorDays, lastTested: 5_000 });
    // The whole distinction between the two intents is this one number.
    assert.ok(seenState(5_000).stability < claimedState(5_000).stability);
  });
});

describe("effectiveState — newest record wins, nothing merged", () => {
  const agg: FactState = { stability: 40, lastTested: 10 * DAY };

  test("no history, no claim, no seen → UNMET", () => {
    assert.deepEqual(effectiveState(undefined, undefined), UNMET);
  });

  test("history alone → the tested state, floored at floorDays", () => {
    assert.deepEqual(effectiveState(agg, undefined), {
      stability: 40,
      lastTested: 10 * DAY,
    });
    // A sub-floor stored stability is lifted to the floor.
    assert.equal(
      effectiveState({ stability: 0.1, lastTested: DAY }, undefined).stability,
      SCORING.floorDays,
    );
  });

  test("an aggregate that was never really tested (lastTested 0) is UNMET, not history", () => {
    assert.deepEqual(effectiveState({ stability: 40, lastTested: 0 }, undefined), UNMET);
  });

  test("a claim NEWER than the last test wins — March miss is not evidence about today", () => {
    // tested in March (small ts), claimed today (large ts).
    const s = effectiveState({ stability: 5, lastTested: 1 * DAY }, 100 * DAY);
    assert.deepEqual(s, claimedState(100 * DAY));
  });

  test("a test NEWER than the claim wins — claim then miss folds from the claimed state", () => {
    // claimed at 50 days, tested at 100 days: the test is newer, history stands.
    const s = effectiveState({ stability: 30, lastTested: 100 * DAY }, 50 * DAY);
    assert.equal(s.lastTested, 100 * DAY);
    assert.equal(s.stability, 30);
  });

  test("'quiz me' newer than both claim and history wins → seenState", () => {
    const s = effectiveState({ stability: 30, lastTested: 1 * DAY }, 2 * DAY, 100 * DAY);
    assert.deepEqual(s, seenState(100 * DAY));
  });

  test("a claim newer than a 'quiz me' wins → claimedState", () => {
    const s = effectiveState(undefined, 100 * DAY, 50 * DAY);
    assert.deepEqual(s, claimedState(100 * DAY));
  });
});

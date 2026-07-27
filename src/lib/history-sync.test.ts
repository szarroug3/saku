// Run: node --import ./src/lib/conjugate/test-hooks.mjs --test \
//        src/lib/history-sync.test.ts
//
// THE BUG THESE PIN
// =================
// Clicking "I already know these" applies the claim to the copy on screen
// immediately and posts in the background (history-writes.ts). The "up next" card
// is a pure function of the history, so it advances on that frame. But the
// provider also revalidates the whole history from the server, and a read that
// was ALREADY IN FLIGHT when the click happened carries the PRE-claim state.
// Landing after the optimistic apply, it overwrote the claim: the card advanced
// and then snapped back to the same lesson. Intermittent, because it needed a
// read to be in flight across the click.
//
// The fix is a monotonic stamp advanced by BOTH a local write and the issuing of
// a read; a read may only land if the stamp has not moved since it left. These
// tests drive that rule through a faithful model of the provider's refresh/apply
// ordering (the SAME exported helpers the provider calls) and assert the three
// outcomes that matter:
//
//   1. a stale in-flight read does NOT revert an optimistic write;
//   2. a refused write (ok:false → a fresh refresh) STILL reverts;
//   3. a genuinely newer server state (issued after our write) STILL wins.

import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { seededState, type HistoryState, type RevalidationOutcome } from "@/lib/history-cache";
import { applyClaims, applySeen, emptyHistory } from "@/lib/history-ops";
import {
  advanceGeneration,
  INITIAL_GENERATION,
  revalidationWins,
  settleRevalidation,
} from "@/lib/history-sync";
import { nextCurriculumLesson } from "@/lib/curriculum-lesson";
import { LESSON_RANGE_DEFAULT } from "@/lib/lesson-sizing";
import type { FactId, HistoryFile } from "@/types";

const RANGE = LESSON_RANGE_DEFAULT;

/**
 * A faithful, network-free model of the provider's two moving parts. It mirrors
 * history-provider.tsx line for line in the way that matters here:
 *
 *   - `apply`      advances the stamp, THEN mutates the copy on screen — exactly
 *                  the provider's optimistic-write path.
 *   - `issueRead`  captures the stamp as the read leaves (the provider's
 *                  `const mine = advanceGeneration(...)`) and returns the settle
 *                  step, which lands the read only if the stamp is unchanged
 *                  (the provider's `settleRevalidation(prev, mine, current, …)`).
 *
 * Splitting a read into issue + settle is what lets a test hold a read "in
 * flight" across a click, which is the whole shape of the bug.
 */
class ProviderModel {
  generation = INITIAL_GENERATION;
  state: HistoryState;

  constructor(initial: HistoryState) {
    this.state = initial;
  }

  apply(op: (h: HistoryFile) => HistoryFile): void {
    this.generation = advanceGeneration(this.generation);
    this.state = { ...this.state, history: op(this.state.history), loaded: true };
  }

  /** Begin a revalidation; returns the function that lands its result later. */
  issueRead(): (outcome: RevalidationOutcome) => void {
    const mine = (this.generation = advanceGeneration(this.generation));
    return (outcome) => {
      this.state = settleRevalidation(this.state, mine, this.generation, outcome);
    };
  }

  card(): FactId[] {
    const lesson = nextCurriculumLesson(this.state.history, RANGE);
    assert.ok(lesson, "the model always has a next lesson in these fixtures");
    return lesson.facts;
  }
}

function server(history: HistoryFile): RevalidationOutcome {
  return { kind: "server", history };
}

describe("an optimistic write is not reverted by a read that predates it", () => {
  test("a stale in-flight revalidation does not snap the claimed card back", () => {
    const preClaim = emptyHistory();
    const model = new ProviderModel(seededState(preClaim));

    const first = model.card();

    // A revalidation is ALREADY in flight, carrying the pre-claim server state.
    const landStaleRead = model.issueRead();

    // The click: apply the claim locally. The card advances this frame.
    model.apply((h) => applyClaims(h, first, 1_000));
    const advanced = model.card();
    assert.notDeepEqual(advanced, first, "the claim advanced the card off the lesson");

    // The in-flight read lands AFTER the click, with the pre-claim history.
    landStaleRead(server(preClaim));

    assert.ok(model.state.history.claims, "the claim survived the stale read");
    assert.ok(
      first.every((f) => model.state.history.claims?.[f] === 1_000),
      "every claimed fact is still claimed",
    );
    assert.deepEqual(model.card(), advanced, "the card did not snap back");
  });

  test("the protection is general: a seen write survives the same race", () => {
    // markSeen shares the optimistic path, so it must share the guard. Nothing
    // about the fix is claim-specific.
    const before = emptyHistory();
    const model = new ProviderModel(seededState(before));
    const facts = model.card();

    const landStaleRead = model.issueRead();
    model.apply((h) => applySeen(h, facts, 2_000));
    landStaleRead(server(before));

    assert.ok(
      facts.every((f) => model.state.history.seen?.[f] === 2_000),
      "the seen record survived the stale read",
    );
  });
});

describe("legitimate corrections are preserved", () => {
  test("a refused write (ok:false → a fresh refresh) still reverts", () => {
    const preClaim = emptyHistory();
    const model = new ProviderModel(seededState(preClaim));
    const facts = model.card();

    model.apply((h) => applyClaims(h, facts, 1_000));
    assert.ok(model.state.history.claims, "claimed optimistically");

    // The post came back NOT ok, so reconcile calls refresh(): a NEW read issued
    // AFTER the apply. Its ticket is current, so its (pre-claim) answer wins.
    const landRefusalRefresh = model.issueRead();
    landRefusalRefresh(server(preClaim));

    assert.equal(
      model.state.history.claims?.[facts[0]],
      undefined,
      "the refused claim was rolled back to the server's truth",
    );
    assert.deepEqual(model.card(), facts, "the card returned to the un-claimed lesson");
  });

  test("a genuinely newer server state (another device) still wins", () => {
    const preClaim = emptyHistory();
    const model = new ProviderModel(seededState(preClaim));
    const facts = model.card();

    model.apply((h) => applyClaims(h, facts, 1_000));

    // Later — a read issued AFTER our write — the server answers with a state that
    // is genuinely newer: our claim PLUS another device's claim of the next set.
    const laterFacts = nextCurriculumLesson(applyClaims(preClaim, facts, 1_000), RANGE)?.facts;
    assert.ok(laterFacts, "there is a lesson after the first");
    const newer = applyClaims(applyClaims(preClaim, facts, 1_000), laterFacts, 2_000);

    const landNewerRead = model.issueRead();
    landNewerRead(server(newer));

    assert.deepEqual(
      model.state.history,
      newer,
      "the newer server truth replaced the local copy outright",
    );
  });
});

describe("the stamp primitives", () => {
  test("advanceGeneration is strictly monotonic", () => {
    let g = INITIAL_GENERATION;
    const seen = new Set<number>([g]);
    for (let i = 0; i < 5; i++) {
      const next = advanceGeneration(g);
      assert.ok(next > g, "each step is larger");
      assert.ok(!seen.has(next), "and never repeats");
      seen.add(next);
      g = next;
    }
  });

  test("revalidationWins only when the stamp is unchanged since the read left", () => {
    const issued = advanceGeneration(INITIAL_GENERATION);
    assert.equal(revalidationWins(issued, issued), true, "unchanged: the read lands");
    assert.equal(
      revalidationWins(issued, advanceGeneration(issued)),
      false,
      "advanced since (a write or a newer read): the read is dropped",
    );
  });

  test("settleRevalidation drops a stale read and keeps the current one", () => {
    const state = seededState(applyClaims(emptyHistory(), ["x" as FactId], 1_000));
    const fresh = server(emptyHistory());

    // stale: current stamp is past the issued ticket → prev is returned untouched.
    assert.equal(settleRevalidation(state, 1, 2, fresh), state);
    // current: issued === current → the outcome is applied.
    assert.deepEqual(settleRevalidation(state, 2, 2, fresh).history, emptyHistory());
  });
});

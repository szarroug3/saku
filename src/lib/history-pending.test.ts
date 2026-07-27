// Run: node --import ./src/lib/conjugate/test-hooks.mjs --test \
//        src/lib/history-pending.test.ts
//
// THE BUG THESE PIN
// =================
// The generation stamp (history-sync.ts) stops a revalidation that LEFT BEFORE
// an optimistic write from reverting it. It cannot stop the OTHER race:
//
//   "I already know these" on a curriculum lesson fires TWO posts — /api/claim
//   AND /api/seen (home-feed.tsx). Each announces itself on landing, and the
//   provider revalidates on hearing one. So the SEEN can land first and trigger
//   a read that is issued AFTER the optimistic apply — it carries a CURRENT
//   ticket and PASSES the stamp guard. If that read reaches the server before the
//   CLAIM post has committed, it reads a state with the seen but WITHOUT the
//   claim, and lands it: the card flickers back to the previous lesson for a
//   frame, until a later read (after the claim commits) restores it.
//
// The fix is a pending-write overlay: every optimistic apply is held until its
// post resolves, and any revalidation that replaces the copy on screen folds the
// still-pending writes back over the fetched snapshot first. A server read that
// has not yet caught up to our own un-acked write therefore cannot erase it.
//
// These tests drive that rule through a faithful model of the provider's
// apply / issueRead / settle ordering — the SAME exported helpers the provider
// calls (settleRevalidation with the pending queue, enqueuePending /
// dequeuePending) — and assert:
//
//   1. a claim's own seen revalidating with STALE pre-claim server state does NOT
//      flicker the card back while the claim post is still in flight;
//   2. once the claim post acks and its op leaves the overlay, the state is still
//      correct;
//   3. a refused write (ok:false → settle then refresh) STILL reverts;
//   4. a genuinely newer server state (another device) STILL wins.

import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { seededState, type HistoryState, type RevalidationOutcome } from "@/lib/history-cache";
import { applyClaims, applySeen, emptyHistory } from "@/lib/history-ops";
import {
  dequeuePending,
  enqueuePending,
  foldPending,
  type PendingWrite,
} from "@/lib/history-pending";
import {
  advanceGeneration,
  INITIAL_GENERATION,
  settleRevalidation,
} from "@/lib/history-sync";
import { nextCurriculumLesson } from "@/lib/curriculum-lesson";
import { LESSON_RANGE_DEFAULT } from "@/lib/lesson-sizing";
import type { FactId, HistoryFile } from "@/types";

const RANGE = LESSON_RANGE_DEFAULT;

/**
 * A faithful, network-free model of the provider's three moving parts, extending
 * history-sync.test.ts's model with the pending-write overlay:
 *
 *   - `apply`      advances the stamp, enqueues the op as un-acknowledged, THEN
 *                  mutates the copy on screen. Returns `settle`, the dequeue the
 *                  caller runs when the post resolves — exactly history-writes.ts.
 *   - `issueRead`  captures the stamp as the read leaves and returns the settle
 *                  step, which lands the read only if the stamp is unchanged AND
 *                  folds the still-pending writes over the fetched snapshot — the
 *                  provider's `settleRevalidation(prev, mine, current, outcome,
 *                  pending.current)`.
 *
 * Splitting both a write and a read into begin + settle is what lets a test hold
 * a read "in flight" across a click and hold a post "un-acked" across a read,
 * which are the two shapes of the bug.
 */
class ProviderModel {
  generation = INITIAL_GENERATION;
  pending: PendingWrite[] = [];
  pendingId = 0;
  state: HistoryState;

  constructor(initial: HistoryState) {
    this.state = initial;
  }

  /** Optimistic write; returns the settle that removes it from the overlay. */
  apply(op: (h: HistoryFile) => HistoryFile): () => void {
    this.generation = advanceGeneration(this.generation);
    const id = (this.pendingId += 1);
    this.pending = enqueuePending(this.pending, id, op);
    this.state = { ...this.state, history: op(this.state.history), loaded: true };
    return () => {
      this.pending = dequeuePending(this.pending, id);
    };
  }

  /** Begin a revalidation; returns the function that lands its result later. */
  issueRead(): (outcome: RevalidationOutcome) => void {
    const mine = (this.generation = advanceGeneration(this.generation));
    return (outcome) => {
      this.state = settleRevalidation(this.state, mine, this.generation, outcome, this.pending);
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

describe("an un-acknowledged write is not erased by a read the server has not caught up to", () => {
  test("a claim's seen revalidating with stale pre-claim state does not flicker the card back", () => {
    // The real curriculum flow: claim + seen fire together. The seen lands first
    // and triggers a read that is issued AFTER the apply (current ticket, passes
    // the stamp) but reaches the server before the claim post commits — so it
    // reads a state with the SEEN but WITHOUT the claim.
    const preClaim = emptyHistory();
    const model = new ProviderModel(seededState(preClaim));
    const lesson = model.card();

    // Both optimistic writes apply on the click; the card advances this frame.
    const settleClaim = model.apply((h) => applyClaims(h, lesson, 1_000));
    const settleSeen = model.apply((h) => applySeen(h, lesson, 1_000));
    const advanced = model.card();
    assert.notDeepEqual(advanced, lesson, "the claim advanced the card off the lesson");

    // The seen post landed first; its announce issues a read AFTER both applies.
    const landSeenRead = model.issueRead();
    // That read reaches the server before the CLAIM committed: seen present,
    // claim absent — the snapshot that, un-overlaid, would flicker the card back.
    const serverSeenOnly = applySeen(preClaim, lesson, 1_000);
    landSeenRead(server(serverSeenOnly));

    // The claim is still pending, so it is folded back on: the card stays put.
    assert.ok(
      lesson.every((f) => model.state.history.claims?.[f] === 1_000),
      "the un-acked claim survived the stale read",
    );
    assert.deepEqual(model.card(), advanced, "the card did not flicker to the previous set");

    // The seen post already acked (it landed first); the claim post finally acks
    // too. Both ops leave the overlay. A later read now carries the claim itself,
    // so folding an empty overlay changes nothing.
    settleSeen();
    settleClaim();
    const landFullRead = model.issueRead();
    landFullRead(server(applyClaims(serverSeenOnly, lesson, 1_000)));
    assert.deepEqual(model.card(), advanced, "still on the advanced set after the ack");
    assert.equal(model.pending.length, 0, "nothing is left pending once every post has resolved");
  });

  test("the overlay is order-preserving across several un-acked writes", () => {
    // Two lessons claimed back to back, both still in flight, when a bare
    // pre-everything server read lands. Both must be folded, in order.
    const base = emptyHistory();
    const model = new ProviderModel(seededState(base));

    const first = model.card();
    model.apply((h) => applyClaims(h, first, 1_000));
    const second = model.card();
    model.apply((h) => applyClaims(h, second, 2_000));
    const advanced = model.card();

    const landStale = model.issueRead();
    landStale(server(base)); // the server has neither claim yet

    assert.ok(first.every((f) => model.state.history.claims?.[f] === 1_000), "first claim folded");
    assert.ok(second.every((f) => model.state.history.claims?.[f] === 2_000), "second claim folded");
    assert.deepEqual(model.card(), advanced, "the card is where both claims left it");
  });
});

describe("legitimate corrections are preserved", () => {
  test("a refused write (settle → refresh) still reverts", () => {
    const preClaim = emptyHistory();
    const model = new ProviderModel(seededState(preClaim));
    const facts = model.card();

    const settle = model.apply((h) => applyClaims(h, facts, 1_000));
    assert.ok(model.state.history.claims, "claimed optimistically");

    // The post came back NOT ok. reconcile settles (drops the op from the overlay)
    // THEN refreshes — so the refresh reads the plain server truth with no refused
    // op folded back on.
    settle();
    const landRefusalRefresh = model.issueRead();
    landRefusalRefresh(server(preClaim));

    assert.equal(
      model.state.history.claims?.[facts[0]],
      undefined,
      "the refused claim was rolled back to the server's truth",
    );
    assert.deepEqual(model.card(), facts, "the card returned to the un-claimed lesson");
  });

  test("a refused write NOT yet settled would still be held — the overlay only drops on settle", () => {
    // Guards the ordering the fix depends on: if a refresh landed BEFORE settle
    // ran, the op is still pending and correctly folded. The revert comes only
    // once settle has removed it, which reconcile guarantees by settling first.
    const preClaim = emptyHistory();
    const model = new ProviderModel(seededState(preClaim));
    const facts = model.card();

    model.apply((h) => applyClaims(h, facts, 1_000));
    const landEarlyRead = model.issueRead();
    landEarlyRead(server(preClaim)); // arrives before the post resolved

    assert.equal(
      model.state.history.claims?.[facts[0]],
      1_000,
      "an un-acked claim is held even against a bare server read",
    );
  });

  test("a genuinely newer server state (another device) still wins", () => {
    const preClaim = emptyHistory();
    const model = new ProviderModel(seededState(preClaim));
    const facts = model.card();

    // Our claim, acknowledged: its op leaves the overlay.
    const settle = model.apply((h) => applyClaims(h, facts, 1_000));
    settle();

    // Later — a read issued after our write — the server answers with a state
    // that is genuinely newer: our claim PLUS another device's claim of the next
    // set. With nothing pending, it replaces the copy outright.
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

  test("a newer server state that already contains our un-acked write wins without duplication", () => {
    // The server has caught up (it holds our claim) and moved further (another
    // device's next claim), but our claim's post has not resolved on THIS client,
    // so its op is still pending. Folding the idempotent op over a snapshot that
    // already carries it is a no-op — the newer state shows through intact.
    const preClaim = emptyHistory();
    const model = new ProviderModel(seededState(preClaim));
    const facts = model.card();

    model.apply((h) => applyClaims(h, facts, 1_000)); // NOT settled: still pending
    const laterFacts = nextCurriculumLesson(applyClaims(preClaim, facts, 1_000), RANGE)?.facts;
    assert.ok(laterFacts, "there is a lesson after the first");
    const newer = applyClaims(applyClaims(preClaim, facts, 1_000), laterFacts, 2_000);

    const landNewerRead = model.issueRead();
    landNewerRead(server(newer));

    assert.deepEqual(
      model.state.history,
      newer,
      "the pending op folded over a snapshot that already had it changed nothing",
    );
  });
});

describe("the overlay primitives", () => {
  test("foldPending replays ops in order and leaves an empty queue untouched", () => {
    const base = emptyHistory();
    assert.equal(foldPending(base, []), base, "no pending writes: the snapshot is returned as-is");

    const a = ["a" as FactId];
    const b = ["b" as FactId];
    const queue = enqueuePending(
      enqueuePending([], 1, (h) => applyClaims(h, a, 1)),
      2,
      (h) => applySeen(h, b, 2),
    );
    const folded = foldPending(base, queue);
    assert.equal(folded.claims?.["a" as FactId], 1, "the first op applied");
    assert.equal(folded.seen?.["b" as FactId], 2, "the second op applied on top");
  });

  test("dequeuePending removes exactly the one write, leaving the rest folded", () => {
    const queue = enqueuePending(
      enqueuePending([], 1, (h) => applyClaims(h, ["a" as FactId], 1)),
      2,
      (h) => applyClaims(h, ["b" as FactId], 2),
    );
    const afterAck = dequeuePending(queue, 1);
    assert.equal(afterAck.length, 1, "one write left");
    const folded = foldPending(emptyHistory(), afterAck);
    assert.equal(folded.claims?.["a" as FactId], undefined, "the acked write no longer folds");
    assert.equal(folded.claims?.["b" as FactId], 2, "the still-pending write does");
  });
});

// Run: node --import ./src/lib/conjugate/test-hooks.mjs --test \
//        src/lib/history-write-reconcile.test.ts
//
// SAK-242: marking a word known/seen/mixed-up while offline silently reverted
// with no error shown, because the caller (history-writes.ts's old `reconcile`)
// assumed a failed request would REJECT the promise it was handed. It never
// does — resolveProgressWrite (progress-write.ts) catches every thrown fetch
// and RESOLVES `{ ok: false, status: 0 }` instead (see progress-write.test.ts),
// so the caller's success handler ran on every offline tap: it dropped the
// optimistic change and refreshed from the server, which had never received
// the write.
//
// These pin `runReconcile`, the decision that replaces it: `status === 0` must
// never be read as a refusal, must retry once connectivity returns (for as
// long as that keeps happening), and must settle/refresh at most once, only
// when the write actually resolves one way or the other.

import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { runReconcile } from "./history-write-reconcile.ts";
import type { ProgressResult } from "./progress-write.ts";

/** A scriptable `send`: hands back the queued results in order, one per call.
 * `"throw"` stands in for a `send` that rejects — defensive-path coverage,
 * since resolveProgressWrite is documented to never actually do this. */
function scriptedSend(results: (ProgressResult | "throw")[]) {
  let i = 0;
  const send = async (): Promise<ProgressResult> => {
    const r = results[i];
    i += 1;
    if (r === "throw") throw new Error("network");
    return r;
  };
  return { send, get count() { return i; } };
}

/** A `waitForOnline` a test can resolve on demand, with a record of how many
 * times reconcile actually waited on it. */
function deferredOnline() {
  let waits = 0;
  let resolveCurrent: (() => void) | null = null;
  const waitForOnline = () => {
    waits += 1;
    return new Promise<void>((resolve) => {
      resolveCurrent = resolve;
    });
  };
  const fireOnline = () => {
    assert.ok(resolveCurrent, "fireOnline called with no pending wait");
    const r = resolveCurrent;
    resolveCurrent = null;
    r!();
  };
  return { waitForOnline, fireOnline, get waits() { return waits; } };
}

function spies() {
  const state = { settle: 0, refresh: 0, waiting: 0, settled: 0 };
  return {
    state,
    settle: () => void state.settle++,
    refresh: () => void state.refresh++,
    onWaiting: () => void state.waiting++,
    onSettled: () => void state.settled++,
  };
}

const OK: ProgressResult = { ok: true, status: 200 };
const REFUSED: ProgressResult = { ok: false, status: 400 };
const OFFLINE: ProgressResult = { ok: false, status: 0 };

describe("runReconcile", () => {
  test("ok: settles, never refreshes, never touches the waiting hooks", async () => {
    const send = scriptedSend([OK]);
    const s = spies();
    const online = deferredOnline();
    await runReconcile({
      send: send.send,
      settle: s.settle,
      refresh: s.refresh,
      waitForOnline: online.waitForOnline,
      onWaiting: s.onWaiting,
      onSettled: s.onSettled,
    });
    assert.equal(send.count, 1);
    assert.equal(s.state.settle, 1);
    assert.equal(s.state.refresh, 0);
    assert.equal(s.state.waiting, 0, "never waited on connectivity");
    assert.equal(s.state.settled, 0);
    assert.equal(online.waits, 0);
  });

  test("a genuine refusal (status !== 0) settles AND refreshes — unchanged from before SAK-242", async () => {
    const send = scriptedSend([REFUSED]);
    const s = spies();
    const online = deferredOnline();
    await runReconcile({
      send: send.send,
      settle: s.settle,
      refresh: s.refresh,
      waitForOnline: online.waitForOnline,
      onWaiting: s.onWaiting,
      onSettled: s.onSettled,
    });
    assert.equal(send.count, 1, "a real refusal is not retried");
    assert.equal(s.state.settle, 1);
    assert.equal(s.state.refresh, 1, "the refused optimistic change is reverted");
    assert.equal(s.state.waiting, 0);
  });

  test("THE BUG: status:0 must NOT be treated as a refusal — no settle, no refresh, while offline", async () => {
    const send = scriptedSend([OFFLINE, OK]);
    const s = spies();
    const online = deferredOnline();
    const done = runReconcile({
      send: send.send,
      settle: s.settle,
      refresh: s.refresh,
      waitForOnline: online.waitForOnline,
      onWaiting: s.onWaiting,
      onSettled: s.onSettled,
    });
    // Give the microtask queue a turn so the first `send` and its branch run.
    await Promise.resolve();
    await Promise.resolve();
    assert.equal(s.state.settle, 0, "the optimistic change must still be on screen");
    assert.equal(s.state.refresh, 0, "must not revert to the server's (unwritten) truth");
    assert.equal(s.state.waiting, 1, "the wait was announced exactly once");
    assert.equal(online.waits, 1, "reconcile is now waiting for connectivity");
    // Let it finish so the test doesn't leave a dangling promise.
    online.fireOnline();
    await done;
  });

  test("offline once, then the retry lands: settles once, never refreshes, wait announced and cleared once", async () => {
    const send = scriptedSend([OFFLINE, OK]);
    const s = spies();
    const online = deferredOnline();
    const done = runReconcile({
      send: send.send,
      settle: s.settle,
      refresh: s.refresh,
      waitForOnline: online.waitForOnline,
      onWaiting: s.onWaiting,
      onSettled: s.onSettled,
    });
    await Promise.resolve();
    await Promise.resolve();
    assert.equal(online.waits, 1);
    online.fireOnline();
    await done;
    assert.equal(send.count, 2, "the same write was retried, not abandoned");
    assert.equal(s.state.settle, 1, "settled exactly once, after the retry landed");
    assert.equal(s.state.refresh, 0, "a write that eventually lands is never reverted");
    assert.equal(s.state.waiting, 1, "onWaiting fires once per wait, not once per failed attempt");
    assert.equal(s.state.settled, 1, "onSettled pairs with the one onWaiting");
  });

  test("offline twice in a row, then a genuine refusal: retries the connectivity failures only, then settles+refreshes once", async () => {
    const send = scriptedSend([OFFLINE, OFFLINE, REFUSED]);
    const s = spies();
    const online = deferredOnline();
    const done = runReconcile({
      send: send.send,
      settle: s.settle,
      refresh: s.refresh,
      waitForOnline: online.waitForOnline,
      onWaiting: s.onWaiting,
      onSettled: s.onSettled,
    });
    await Promise.resolve();
    await Promise.resolve();
    assert.equal(online.waits, 1);
    online.fireOnline();
    await Promise.resolve();
    await Promise.resolve();
    assert.equal(online.waits, 2, "still offline, waits again");
    assert.equal(
      s.state.waiting,
      1,
      "one continuous wait, not re-announced on the second offline attempt",
    );
    online.fireOnline();
    await done;
    assert.equal(send.count, 3);
    assert.equal(s.state.settle, 1);
    assert.equal(s.state.refresh, 1, "the eventual real refusal still reverts");
    assert.equal(s.state.settled, 1);
  });

  test("a send() that throws (defensive: resolveProgressWrite is documented never to) is treated exactly like status:0", async () => {
    const send = scriptedSend(["throw", OK]);
    const s = spies();
    const online = deferredOnline();
    const done = runReconcile({
      send: send.send,
      settle: s.settle,
      refresh: s.refresh,
      waitForOnline: online.waitForOnline,
      onWaiting: s.onWaiting,
      onSettled: s.onSettled,
    });
    await Promise.resolve();
    await Promise.resolve();
    assert.equal(s.state.settle, 0);
    assert.equal(s.state.refresh, 0);
    assert.equal(online.waits, 1);
    online.fireOnline();
    await done;
    assert.equal(s.state.settle, 1);
    assert.equal(s.state.refresh, 0);
  });
});

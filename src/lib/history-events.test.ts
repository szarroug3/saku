import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  coveredByRefresh,
  notifyHistoryWrite,
  onHistoryWrite,
} from "@/lib/history-events";

describe("history write notifications", () => {
  it("tells every listener when the write landed", () => {
    const heard: number[] = [];
    const stop = onHistoryWrite((at) => heard.push(at));
    const stop2 = onHistoryWrite((at) => heard.push(at + 1000));
    notifyHistoryWrite(7);
    stop();
    stop2();
    assert.deepEqual(heard, [7, 1007]);
  });

  it("stops telling a listener that unsubscribed", () => {
    let heard = 0;
    const stop = onHistoryWrite(() => (heard += 1));
    notifyHistoryWrite(1);
    stop();
    notifyHistoryWrite(2);
    assert.equal(heard, 1);
  });

  it("survives a listener unsubscribing mid-announcement", () => {
    // The provider unmounting while a write is being announced. Iterating the
    // live set would skip the listener after it.
    const heard: string[] = [];
    let stopB: (() => void) | null = null;
    const stopA = onHistoryWrite(() => {
      heard.push("a");
      stopB?.();
    });
    stopB = onHistoryWrite(() => heard.push("b"));
    assert.doesNotThrow(() => notifyHistoryWrite(1));
    stopA();
    stopB();
    assert.deepEqual(heard, ["a", "b"]);
  });
});

describe("whether a write still needs a refetch", () => {
  it("counts a revalidation issued after the write", () => {
    assert.equal(coveredByRefresh(500, 400), true);
    // Same millisecond: the request left after the write returned, so it has it.
    assert.equal(coveredByRefresh(400, 400), true);
  });

  it("does not count one that left before the write landed", () => {
    assert.equal(coveredByRefresh(300, 400), false);
    // Nothing has been fetched at all yet.
    assert.equal(coveredByRefresh(0, 400), false);
  });
});

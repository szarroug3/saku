// Run: node --import ./src/lib/conjugate/test-hooks.mjs --test \
//        src/lib/session-staleness.test.ts
//
// SAK-67: "Current sessions" accumulated silently with no hint about which
// entries had gone stale. isStaleRun is the judgment call this ticket asked
// for — see the doc comment on STALE_AFTER_MS for the reasoning — and it is
// deliberately just a HINT function: nothing here deletes anything.

import assert from "node:assert/strict";
import { test } from "node:test";

import { isStaleRun, STALE_AFTER_MS } from "@/lib/session-staleness";

test("a run touched moments ago is not stale", () => {
  const now = 10_000_000;
  assert.equal(isStaleRun(now - 60_000, now), false);
});

test("a run just under the threshold is not yet stale", () => {
  const now = 10_000_000;
  assert.equal(isStaleRun(now - (STALE_AFTER_MS - 1), now), false);
});

test("a run right at the threshold is not stale (strictly greater)", () => {
  const now = 10_000_000;
  assert.equal(isStaleRun(now - STALE_AFTER_MS, now), false);
});

test("a run past the threshold is stale", () => {
  const now = 10_000_000;
  assert.equal(isStaleRun(now - (STALE_AFTER_MS + 1), now), true);
});

test("a run abandoned for a week is stale", () => {
  const now = 10_000_000;
  assert.equal(isStaleRun(now - 7 * 24 * 60 * 60 * 1000, now), true);
});

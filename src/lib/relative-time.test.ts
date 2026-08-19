// Run: node --import ./src/lib/conjugate/test-hooks.mjs --test \
//        src/lib/relative-time.test.ts

import assert from "node:assert/strict";
import { test } from "node:test";

import { relativeTime } from "@/lib/relative-time";

const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

test("under a minute reads as just now", () => {
  const now = 1_000_000;
  assert.equal(relativeTime(now - 10_000, now), "just now");
  assert.equal(relativeTime(now, now), "just now");
});

test("singular vs plural minutes", () => {
  const now = 1_000_000;
  assert.equal(relativeTime(now - 1 * MIN, now), "1 minute ago");
  assert.equal(relativeTime(now - 5 * MIN, now), "5 minutes ago");
});

test("switches to hours at 60 minutes", () => {
  const now = 1_000_000;
  assert.equal(relativeTime(now - 60 * MIN, now), "1 hour ago");
  assert.equal(relativeTime(now - 3 * HOUR, now), "3 hours ago");
});

test("switches to days at 24 hours", () => {
  const now = 1_000_000;
  assert.equal(relativeTime(now - 24 * HOUR, now), "1 day ago");
  assert.equal(relativeTime(now - 5 * DAY, now), "5 days ago");
});

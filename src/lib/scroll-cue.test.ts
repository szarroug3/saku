// Run: node --import ./src/lib/conjugate/test-hooks.mjs --test \
//        src/lib/scroll-cue.test.ts

import assert from "node:assert/strict";
import { test } from "node:test";

import { isNearPageBottom } from "./scroll-cue";

test("not at the bottom when the page runs well past the fold", () => {
  // 800px viewport, unscrolled, 1600px of page — half is below the fold.
  assert.equal(isNearPageBottom(0, 800, 1600), false);
});

test("at the bottom once the viewport covers the rest of the page", () => {
  assert.equal(isNearPageBottom(800, 800, 1600), true);
});

test("a page that already fits the viewport is always at the bottom", () => {
  assert.equal(isNearPageBottom(0, 800, 600), true);
});

test("the threshold absorbs a near-miss without flicker", () => {
  // 10px short of exact, inside the default 24px threshold.
  assert.equal(isNearPageBottom(790, 800, 1600), true);
  // Outside the threshold: still short of the bottom.
  assert.equal(isNearPageBottom(700, 800, 1600), false);
});

test("a custom threshold is respected", () => {
  assert.equal(isNearPageBottom(750, 800, 1600), false);
  assert.equal(isNearPageBottom(750, 800, 1600, 100), true);
});

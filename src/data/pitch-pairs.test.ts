// Run: node --import ./src/lib/conjugate/test-hooks.mjs --test src/data/pitch-pairs.test.ts

import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { wordPitch } from "./pitch.ts";
import { pitchPairsFor } from "./pitch-pairs.ts";

describe("pitchPairsFor — the homophone-pitch table SAK-128's pair mode draws from", () => {
  test("箸/橋 (both はし, different downsteps) pair with each other", () => {
    const pairs = pitchPairsFor("箸");
    assert.ok(pairs.some((p) => p.partner === "橋"));
    const partner = pairs.find((p) => p.partner === "橋")!;
    assert.equal(partner.reading, "はし");
    assert.notEqual(wordPitch("箸"), wordPitch("橋"));
  });

  test("is symmetric: 橋 pairs back with 箸", () => {
    const pairs = pitchPairsFor("橋");
    assert.ok(pairs.some((p) => p.partner === "箸"));
  });

  test("a word absent from the table returns empty, never fabricated", () => {
    assert.deepEqual(pitchPairsFor("__not_a_word__"), []);
  });

  test("every pair's two words carry a VERIFIED, DIFFERENT downstep", () => {
    // A cheap re-verification over a sample rather than the whole table: the
    // ingest script (scripts/ingest/pitch-pairs.mjs) already proves this at
    // build time, so this is a regression guard, not a full audit.
    for (const keb of ["箸", "橋", "端"]) {
      for (const pair of pitchPairsFor(keb)) {
        const a = wordPitch(keb);
        const b = wordPitch(pair.partner);
        assert.notEqual(a, null);
        assert.notEqual(b, null);
        assert.notEqual(a, b);
      }
    }
  });
});

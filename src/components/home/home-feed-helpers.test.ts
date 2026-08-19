// Run: node --import ./src/lib/conjugate/test-hooks.mjs --test \
//        src/components/home/home-feed-helpers.test.ts
//
// WHAT THIS PINS
// ===============
// SAK-86: a real "Start" on a sentence tier (`teach: true`) never claimed the
// tier known, whether the session ended early or reached the normal
// completion screen. Root cause: `sentenceSessionTeach` handed startSession a
// `teach` array that excluded the tier's progress marker fact. `endSession`
// claims via `sessionKnownClaimTarget` (src/lib/session.ts), which reads
// `teach` as its candidate set whenever `teach` is non-empty — so a `teach`
// missing the marker meant the marker could never be part of the automatic
// end-of-session claim.
//
// The fix folds the marker into `teach` on the `teach: true` branch. The
// `teach: false` (Quiz-me) branch must keep excluding it — SAK-85 fixed a bug
// where a non-empty `teach` flipped Quiz-me into opening the lesson instead of
// the quiz — so this pins both branches at once.

import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { sentenceSessionTeach } from "@/components/home/home-feed-helpers";
import type { FactId } from "@/types";

const drillFactA = "grammar:te/production@v5u" as FactId;
const drillFactB = "grammar:te/production@v5k" as FactId;
const marker = "sentence-tier:simple" as FactId;

describe("sentenceSessionTeach", () => {
  test("teach: true includes the marker alongside the drill facts (SAK-86)", () => {
    const teach = sentenceSessionTeach(true, [drillFactA, drillFactB], marker);

    assert.deepEqual(teach, [drillFactA, drillFactB, marker]);
    assert.ok(teach.includes(marker), "marker must ride in teach when teach: true");
  });

  test("teach: false stays empty, marker excluded (guards SAK-85)", () => {
    const teach = sentenceSessionTeach(false, [drillFactA, drillFactB], marker);

    assert.ok(!teach.includes(marker), "marker must not ride in teach when teach: false");
    assert.deepEqual(teach, [] as FactId[]);
  });
});

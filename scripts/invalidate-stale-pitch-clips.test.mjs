// Run: node --import ./src/lib/conjugate/test-hooks.mjs --test scripts/invalidate-stale-pitch-clips.test.mjs
//
// SAK-217: pins `stalePitchClips()`/`stalePitchItemsForReading()` (this
// script's pure path-computation, no Supabase/network involved) against an
// INDEPENDENTLY recomputed expectation for a few real confirmed-bad readings
// — correct downstep(s) via wordPitch, distractor downstep(s) via
// wrongDownstepFor, every voice via pitchObjectPath — so a pass here can't
// agree with the script's own logic by construction. Also checks a reading
// NOT in CONFIRMED_BAD_READINGS produces zero paths, since that gate is the
// only thing standing between this script and deleting clips for words
// SAK-215 never touched.

import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { wordPitch } from "@/data/pitch";
import { VOCAB } from "@/data/vocab";
import { CONFIRMED_BAD_READINGS } from "@/lib/tts-synth";
import { moraeOf, wrongDownstepFor } from "@/lib/pitch";
import { pitchObjectPath, VOICES } from "@/lib/voice";

import { stalePitchClips, stalePitchItemsForReading } from "./invalidate-stale-pitch-clips.mjs";

/** Independently recompute every (downstep) that should be stale for one
 * reading, straight from VOCAB/wordPitch/wrongDownstepFor — not by calling
 * anything the script itself calls — so this is a real cross-check, not a
 * restatement of pitchItems()'s own logic. */
function expectedDownstepsFor(reading) {
  const downsteps = new Set();
  for (const row of VOCAB) {
    if (row.reb !== reading) continue;
    const downstep = wordPitch(row.keb);
    if (downstep === null) continue;
    downsteps.add(downstep);
    const wrongDownstep = wrongDownstepFor(downstep, moraeOf(row.reb).length);
    if (wrongDownstep !== null) downsteps.add(wrongDownstep);
  }
  return downsteps;
}

describe("stalePitchClips — SAK-217 stale-clip invalidation", () => {
  test("every CONFIRMED_BAD_READINGS entry produces the exact set of paths independently recomputed from VOCAB", () => {
    // A reading with more than one distinct downstep across its kanji
    // spellings (はち: 八 downstep 0, 鉢/蜂 downstep 2) is exactly the case a
    // naive "one downstep per reading" implementation would get wrong — make
    // sure it's covered here, not just the simple single-downstep readings.
    for (const reading of ["はち", "はで", "しはい", "へいこう"]) {
      assert.ok(
        CONFIRMED_BAD_READINGS.includes(reading),
        `test fixture problem: ${reading} is expected to be in CONFIRMED_BAD_READINGS`,
      );

      const expectedDownsteps = expectedDownstepsFor(reading);
      assert.ok(expectedDownsteps.size > 0, `test fixture problem: no VOCAB row backs reading ${reading}`);

      const expectedPaths = new Set(
        [...expectedDownsteps].flatMap((downstep) =>
          VOICES.map((voice) => pitchObjectPath(reading, downstep, voice.id)),
        ),
      );

      const items = stalePitchItemsForReading(reading);
      assert.deepEqual(new Set(items.map((i) => i.downstep)), expectedDownsteps, `downstep mismatch for ${reading}`);

      const actualPaths = new Set(items.flatMap((item) => VOICES.map((voice) => pitchObjectPath(reading, item.downstep, voice.id))));
      assert.deepEqual(actualPaths, expectedPaths, `path mismatch for ${reading}`);

      // And stalePitchClips()'s own output for this reading matches too.
      const clipsForReading = stalePitchClips().filter((c) => c.reading === reading);
      assert.deepEqual(new Set(clipsForReading.map((c) => c.path)), expectedPaths, `stalePitchClips mismatch for ${reading}`);
      assert.equal(clipsForReading.length, expectedPaths.size);
    }
  });

  test("stalePitchClips() total equals the sum of every CONFIRMED_BAD_READINGS reading's own path count, with no duplicates and no extras", () => {
    const clips = stalePitchClips();
    const paths = clips.map((c) => c.path);
    assert.equal(new Set(paths).size, paths.length, "stalePitchClips() produced a duplicate path");

    let expectedTotal = 0;
    for (const reading of CONFIRMED_BAD_READINGS) {
      expectedTotal += expectedDownstepsFor(reading).size * VOICES.length;
    }
    assert.equal(clips.length, expectedTotal);

    // Every clip's reading must itself be a confirmed-bad reading — this
    // script must never target audio for a word SAK-215 didn't touch.
    for (const clip of clips) {
      assert.ok(CONFIRMED_BAD_READINGS.includes(clip.reading), `unexpected reading ${clip.reading} in stalePitchClips()`);
    }
  });

  test("a reading NOT in CONFIRMED_BAD_READINGS produces no paths at all", () => {
    const ordinaryReading = "がっこう"; // "school" — an ordinary reading, no は/へ misreading involved.
    assert.ok(!CONFIRMED_BAD_READINGS.includes(ordinaryReading), "test fixture problem: pick a reading not in the bad list");

    assert.deepEqual(stalePitchItemsForReading(ordinaryReading), []);
    assert.deepEqual(
      stalePitchClips().filter((c) => c.reading === ordinaryReading),
      [],
    );
  });
});

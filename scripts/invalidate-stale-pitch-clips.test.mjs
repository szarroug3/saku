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
//
// SAK-290 adds the same treatment for the second target (`sak-221`): its
// pairs recomputed independently from SAK_221_PREVIOUS_PITCH + VOCAB +
// wrongDownstepFor, the guarantee that it never proposes a path
// `pitchItems()` still enumerates, and the guarantee that adding a target
// changed nothing about the default (SAK-217) behaviour.
//
// SAK-219 adds a third target (`sak-219`) covering the GENERAL (non-pitch)
// audio clips — a different Storage namespace (`voiceObjectPath`, no
// downstep dimension) from the other two targets' `pitchObjectPath`. Same
// independence discipline: paths recomputed straight from
// CONFIRMED_BAD_READINGS + voiceObjectPath, never by calling this script's
// own logic back at itself.

import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { wordPitch } from "@/data/pitch";
import { VOCAB } from "@/data/vocab";
import { CONFIRMED_BAD_READINGS } from "@/lib/tts-synth";
import { moraeOf, wrongDownstepFor } from "@/lib/pitch";
import { pitchObjectPath, VOICES, voiceObjectPath } from "@/lib/voice";

import { pitchItems } from "./seed-voice-audio.mjs";
import {
  SAK_217_TARGET,
  SAK_219_TARGET,
  SAK_221_PREVIOUS_PITCH,
  SAK_221_TARGET,
  sak221RetainedItems,
  stalePitchClips,
  stalePitchItemsForReading,
  TARGETS,
} from "./invalidate-stale-pitch-clips.mjs";

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

/** Every (reading, downstep) pair that IS enumerated today, recomputed
 * straight from VOCAB/wordPitch/wrongDownstepFor rather than by calling
 * `pitchItems()` — the same independence discipline as `expectedDownstepsFor`
 * above, so "this pair is still live" isn't just pitchItems() agreeing with
 * itself. */
function livePairKeys() {
  const live = new Set();
  for (const row of VOCAB) {
    const downstep = wordPitch(row.keb);
    if (downstep === null) continue;
    live.add(`${row.reb}:${downstep}`);
    const wrongDownstep = wrongDownstepFor(downstep, moraeOf(row.reb).length);
    if (wrongDownstep !== null) live.add(`${row.reb}:${wrongDownstep}`);
  }
  return live;
}

/** Independently recompute what SAK-221's target should delete: for each word
 * whose pitch.json value that ticket changed, the pair at its PREVIOUS
 * downstep plus the distractor that previous downstep implied — minus
 * anything still live today (those are "retained", not stale). */
function expectedSak221Pairs() {
  const live = livePairKeys();
  const stale = new Set();
  const retained = new Set();
  for (const [written, previousDownstep] of Object.entries(SAK_221_PREVIOUS_PITCH)) {
    for (const row of VOCAB) {
      if (row.keb !== written) continue;
      const wrongDownstep = wrongDownstepFor(previousDownstep, moraeOf(row.reb).length);
      const downsteps = wrongDownstep === null ? [previousDownstep] : [previousDownstep, wrongDownstep];
      for (const downstep of downsteps) {
        const pairKey = `${row.reb}:${downstep}`;
        (live.has(pairKey) ? retained : stale).add(pairKey);
      }
    }
  }
  return { stale, retained };
}

describe("stalePitchClips — SAK-290 target selection", () => {
  test("the default target is still SAK-217's, unchanged by adding a second target", () => {
    assert.deepEqual(stalePitchClips(), stalePitchClips(SAK_217_TARGET));
    assert.deepEqual(stalePitchItemsForReading("はち"), stalePitchItemsForReading("はち", SAK_217_TARGET));
    assert.deepEqual(Object.keys(TARGETS).sort(), ["sak-217", "sak-219", "sak-221"]);
  });

  test("SAK_221_PREVIOUS_PITCH records values pitch.json no longer holds", () => {
    for (const [written, previousDownstep] of Object.entries(SAK_221_PREVIOUS_PITCH)) {
      assert.ok(
        VOCAB.some((row) => row.keb === written),
        `test fixture problem: ${written} is not in VOCAB`,
      );
      assert.notEqual(
        wordPitch(written),
        previousDownstep,
        `${written} still ships the value SAK_221_PREVIOUS_PITCH calls superseded`,
      );
    }
    // The three words SAK-221 removed outright hold no value at all now.
    for (const written of ["仏", "悪口", "背"]) {
      assert.equal(wordPitch(written), null, `${written} should hold no pitch value after SAK-221`);
    }
  });

  test("the sak-221 target's paths are exactly the old-value pairs no longer enumerated, across every voice", () => {
    const { stale, retained } = expectedSak221Pairs();
    assert.ok(stale.size > 0, "test fixture problem: expected at least one orphaned old-value pair");

    const clips = stalePitchClips(SAK_221_TARGET);
    const actualPairs = new Set(clips.map((c) => `${c.reading}:${c.downstep}`));
    assert.deepEqual(actualPairs, stale);

    const expectedPaths = new Set(
      [...stale].flatMap((pairKey) => {
        const idx = pairKey.lastIndexOf(":");
        const reading = pairKey.slice(0, idx);
        const downstep = Number(pairKey.slice(idx + 1));
        return VOICES.map((voice) => pitchObjectPath(reading, downstep, voice.id));
      }),
    );
    const actualPaths = clips.map((c) => c.path);
    assert.equal(new Set(actualPaths).size, actualPaths.length, "duplicate path in the sak-221 target");
    assert.deepEqual(new Set(actualPaths), expectedPaths);
    assert.equal(clips.length, stale.size * VOICES.length);

    // And the pairs it deliberately keeps are exactly the still-live ones.
    assert.deepEqual(new Set(sak221RetainedItems().map((i) => `${i.reading}:${i.downstep}`)), retained);
  });

  test("the sak-221 target never proposes a path that is still enumerated today", () => {
    const live = new Set(pitchItems().map((item) => `${item.reading}:${item.downstep}`));
    for (const clip of stalePitchClips(SAK_221_TARGET)) {
      assert.ok(
        !live.has(`${clip.reading}:${clip.downstep}`),
        `${clip.reading}:${clip.downstep} is still enumerated — deleting it would drop a live, correct clip`,
      );
    }

    // Concretely: no corrected word's CURRENT downstep clip is on the list.
    for (const written of Object.keys(SAK_221_PREVIOUS_PITCH)) {
      const downstep = wordPitch(written);
      if (downstep === null) continue;
      for (const row of VOCAB.filter((r) => r.keb === written)) {
        const currentPaths = new Set(VOICES.map((voice) => pitchObjectPath(row.reb, downstep, voice.id)));
        for (const clip of stalePitchClips(SAK_221_TARGET)) {
          assert.ok(!currentPaths.has(clip.path), `${written}'s corrected clip ${clip.path} must not be deleted`);
        }
      }
    }
  });

  test("a reading outside the chosen target produces no paths under that target", () => {
    // ほとけ (仏) is a SAK-221 reading and NOT a SAK-215 one — each target
    // gates on its own list, so the reading is live under one and invisible
    // to the other.
    assert.ok(!CONFIRMED_BAD_READINGS.includes("ほとけ"), "test fixture problem: ほとけ should not be a SAK-215 reading");
    assert.deepEqual(stalePitchItemsForReading("ほとけ", SAK_217_TARGET), []);
    assert.ok(stalePitchItemsForReading("ほとけ", SAK_221_TARGET).length > 0);

    // And a SAK-215 reading with no SAK-221 involvement is invisible to the
    // sak-221 target.
    assert.deepEqual(stalePitchItemsForReading("はち", SAK_221_TARGET), []);
  });
});

describe("stalePitchClips — SAK-219 general-audio target", () => {
  test("the sak-219 target covers every CONFIRMED_BAD_READINGS entry, exactly one voiceObjectPath clip per reading per voice", () => {
    const clips = stalePitchClips(SAK_219_TARGET);

    const expectedPaths = new Set(
      CONFIRMED_BAD_READINGS.flatMap((reading) => VOICES.map((voice) => voiceObjectPath(voice.id, reading))),
    );
    const actualPaths = new Set(clips.map((c) => c.path));
    assert.deepEqual(actualPaths, expectedPaths);
    assert.equal(new Set(clips.map((c) => c.path)).size, clips.length, "duplicate path in the sak-219 target");
    assert.equal(clips.length, CONFIRMED_BAD_READINGS.length * VOICES.length);

    // No downstep dimension for this target — every clip carries null.
    assert.ok(clips.every((c) => c.downstep === null));

    // Every clip's reading must itself be a confirmed-bad reading — same
    // discipline as the sak-217 target's own equivalent guard.
    for (const clip of clips) {
      assert.ok(CONFIRMED_BAD_READINGS.includes(clip.reading), `unexpected reading ${clip.reading} in sak-219 target`);
    }
  });

  test("a reading NOT in CONFIRMED_BAD_READINGS produces no paths under the sak-219 target either", () => {
    const ordinaryReading = "がっこう";
    assert.ok(!CONFIRMED_BAD_READINGS.includes(ordinaryReading));
    assert.deepEqual(stalePitchItemsForReading(ordinaryReading, SAK_219_TARGET), []);
  });

  test("the sak-219 target's paths land in the SAME general voices/<voiceId>/ namespace synthesizeText/synthesizeSentenceWav actually read/write, not the pitch namespace", () => {
    const [firstClip] = stalePitchClips(SAK_219_TARGET);
    assert.ok(firstClip.path.startsWith(`voices/${firstClip.voiceId}/`));
    assert.ok(!firstClip.path.includes("/pitch-"), "sak-219 clips must never collide with the pitch cache's own sub-namespace");
  });

  test("adding the sak-219 target changed nothing about the sak-217/sak-221 targets' own default behaviour", () => {
    assert.deepEqual(stalePitchClips(), stalePitchClips(SAK_217_TARGET));
    assert.deepEqual(stalePitchItemsForReading("はち"), stalePitchItemsForReading("はち", SAK_217_TARGET));
  });
});

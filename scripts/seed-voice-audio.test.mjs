// Run: node --import ./src/lib/conjugate/test-hooks.mjs --test scripts/seed-voice-audio.test.mjs
//
// SAK-216: Sam explicitly asked for distractor pitch clips to be seeded, not
// just each word's correct reading — the live "wrong"-mode quiz
// (src/lib/pitch-quiz.ts's rollPitchQuestion) fetches a distractor clip at
// wrongDownstepFor's downstep, and before this ticket that clip only ever got
// synthesized lazily, the first time a real learner's session requested it.
//
// This pins `pitchItems()` (the seed script's own enumeration of every
// (reading, downstep) pair the EXACT-pitch cache can be asked for) against
// the REAL VOCAB corpus and the REAL `wrongDownstepFor` — not a fabricated
// fixture — so a pass here can't disagree with what the live quiz would
// independently compute and request. `pitchItems` and its dependencies are
// pure (no fetch, no Supabase, no VOICEVOX), so this imports the script
// module directly; `main()` at the bottom is import-guarded specifically so
// doing that doesn't also try to run the real seed.

import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { wordPitch } from "@/data/pitch";
import { VOCAB } from "@/data/vocab";
import { moraeOf, wrongDownstepFor } from "@/lib/pitch";
import { VOICE_PREVIEW } from "@/lib/voice";

import { pitchItems } from "./seed-voice-audio.mjs";

describe("pitchItems — SAK-216 distractor coverage", () => {
  test("every VOCAB word with a verified downstep gets both a correct item and (when honest) a distractor item", () => {
    const items = pitchItems();
    const present = new Set(items.map((i) => `${i.reading}:${i.downstep}`));

    let checked = 0;
    let withDistractor = 0;
    for (const row of VOCAB) {
      const downstep = wordPitch(row.keb);
      if (downstep === null) continue;
      checked++;

      // The correct-downstep item must still be there, unchanged.
      assert.ok(
        present.has(`${row.reb}:${downstep}`),
        `missing correct item for ${row.keb} (${row.reb}, downstep ${downstep})`,
      );

      // The distractor must match wrongDownstepFor EXACTLY — same function,
      // same inputs the live "wrong"-mode quiz uses — or, when that word has
      // no honest distractor (a 1-mora reading), no distractor item should
      // have been invented for it.
      const wrongDownstep = wrongDownstepFor(downstep, moraeOf(row.reb).length);
      if (wrongDownstep === null) continue;
      withDistractor++;
      assert.ok(
        present.has(`${row.reb}:${wrongDownstep}`),
        `missing distractor item for ${row.keb} (${row.reb}, distractor downstep ${wrongDownstep})`,
      );
    }

    // Sanity floor so this test can't silently pass over an empty corpus.
    assert.ok(checked > 0, "no VOCAB row carried a verified pitch — test fixture problem, not a real pass");
    assert.ok(withDistractor > 0, "no word in VOCAB has an eligible (>=2 mora) reading — check test data");
  });

  test("a 1-mora verified word gets no distractor item (mirrors rollPitchQuestion's own null handling)", () => {
    const oneMoraRow = VOCAB.find((row) => {
      const downstep = wordPitch(row.keb);
      return downstep !== null && moraeOf(row.reb).length < 2;
    });
    // Only assert the behavior if such a word actually exists in the corpus
    // right now — its presence isn't this test's concern, its handling is.
    if (!oneMoraRow) return;

    const downstep = wordPitch(oneMoraRow.keb);
    assert.equal(wrongDownstepFor(downstep, moraeOf(oneMoraRow.reb).length), null);

    const items = pitchItems();
    const itemsForReading = items.filter((i) => i.reading === oneMoraRow.reb);
    assert.deepEqual(
      itemsForReading.map((i) => i.downstep),
      [downstep],
      `expected exactly one (correct-only) item for 1-mora word ${oneMoraRow.keb}`,
    );
  });

  test("VOICE_PREVIEW is still seeded once, with no distractor invented for it", () => {
    const items = pitchItems();
    const previewItems = items.filter((i) => i.reading === VOICE_PREVIEW.reading);
    // せんせい may also independently appear as a real VOCAB word's own
    // correct/distractor reading, so this checks the specific downstep is
    // present rather than asserting an exact count.
    assert.ok(previewItems.some((i) => i.downstep === VOICE_PREVIEW.downstep));
  });

  test("roughly doubles the item count versus correct-only seeding, not more and not less", () => {
    const items = pitchItems();
    const present = new Set(items.map((i) => `${i.reading}:${i.downstep}`));

    let correctOnlyCount = 1; // VOICE_PREVIEW
    const correctOnlySeen = new Set([`${VOICE_PREVIEW.reading}:${VOICE_PREVIEW.downstep}`]);
    let expectedTotal = correctOnlyCount;
    const expectedSeen = new Set(correctOnlySeen);

    for (const row of VOCAB) {
      const downstep = wordPitch(row.keb);
      if (downstep === null) continue;
      const correctKey = `${row.reb}:${downstep}`;
      if (!correctOnlySeen.has(correctKey)) {
        correctOnlySeen.add(correctKey);
        correctOnlyCount++;
      }
      if (!expectedSeen.has(correctKey)) {
        expectedSeen.add(correctKey);
        expectedTotal++;
      }
      const wrongDownstep = wrongDownstepFor(downstep, moraeOf(row.reb).length);
      if (wrongDownstep === null) continue;
      const wrongKey = `${row.reb}:${wrongDownstep}`;
      if (!expectedSeen.has(wrongKey)) {
        expectedSeen.add(wrongKey);
        expectedTotal++;
      }
    }

    // Exact dedup-aware expectation, independently re-derived here rather than
    // re-imported from the script, so this can't just be checking pitchItems
    // against its own logic.
    assert.equal(items.length, expectedTotal);
    assert.equal(present.size, expectedTotal);
    // And it really did grow versus the old correct-only shape (not a no-op).
    assert.ok(
      expectedTotal > correctOnlyCount,
      "distractor items should add strictly more entries than correct-only seeding",
    );
  });
});

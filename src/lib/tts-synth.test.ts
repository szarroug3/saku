// Run: node --import ./src/lib/conjugate/test-hooks.mjs --test src/lib/tts-synth.test.ts
//
// Only `wrongDownstepFor` is tested here — everything else in tts-synth.ts
// makes real network calls to a VOICEVOX engine and has no pure surface to
// pin. See src/lib/pitch-quiz.test.ts and src/data/pitch-pairs.test.ts for
// the rest of SAK-128's pitch-quiz logic.

import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { pitchPatternForLength } from "./pitch.ts";
import { wrongDownstepFor } from "./tts-synth.ts";

describe("wrongDownstepFor — SAK-128's synthetic wrong-pitch distractor pattern", () => {
  test("heiban (0) gets atamadaka (1) — unchanged from before SAK-129", () => {
    assert.equal(wrongDownstepFor(0, 4), 1);
  });

  test("atamadaka (1) gets heiban (0) — unchanged from before SAK-129", () => {
    assert.equal(wrongDownstepFor(1, 4), 0);
  });

  test("anything else (nakadaka/odaka) gets atamadaka (1), not heiban (0)", () => {
    // SAK-129: the old `correct === 0 ? 1 : 0` swap paired every non-heiban
    // correct downstep against heiban — which is acoustically IDENTICAL to
    // odaka in isolation (see the "odaka" test below). Pairing against
    // atamadaka instead is distinguishable on mora 1 from every other real
    // pattern.
    assert.equal(wrongDownstepFor(2, 4), 1);
    assert.equal(wrongDownstepFor(3, 4), 1);
  });

  test("a 1-mora reading has no distinguishable wrong pattern", () => {
    assert.equal(wrongDownstepFor(0, 1), null);
    assert.equal(wrongDownstepFor(1, 1), null);
  });

  test("the wrong pattern is always different from the correct one", () => {
    for (let correct = 0; correct <= 4; correct++) {
      const wrong = wrongDownstepFor(correct, 5);
      assert.notEqual(wrong, correct);
    }
  });

  test("odaka (SAK-129 regression): the wrong clip is ACOUSTICALLY distinguishable, not just a different integer", () => {
    // A 2-mora odaka word: downstep === moraCount (2). In isolation,
    // pitchPatternForLength makes heiban (0) and odaka (2) render the exact
    // same high/low sequence — both low on mora 1, high on mora 2 — because
    // odaka's drop lands on a following particle that doesn't exist when the
    // word is synthesized alone. The old swap (`correct === 0 ? 1 : 0`)
    // picked heiban here, producing a "wrong" clip identical to the correct
    // one. The fix must pick something whose high/low sequence differs.
    const correct = 2;
    const moraCount = 2;
    const wrong = wrongDownstepFor(correct, moraCount);
    assert.notEqual(wrong, null);

    const correctPattern = pitchPatternForLength(moraCount, correct).map(
      (m) => m.high,
    );
    const wrongPattern = pitchPatternForLength(moraCount, wrong as number).map(
      (m) => m.high,
    );

    // Sanity: confirm the bug this test guards against is real — heiban (the
    // OLD answer) really is acoustically identical to this odaka pattern.
    const heibanPattern = pitchPatternForLength(moraCount, 0).map(
      (m) => m.high,
    );
    assert.deepEqual(
      heibanPattern,
      correctPattern,
      "expected heiban and odaka to collide in isolation — if this fails, the premise of the SAK-129 bug fix changed",
    );

    // The actual regression assertion: today's wrong pattern must differ
    // from the correct pattern's high/low sequence, not just its integer.
    assert.notDeepEqual(
      wrongPattern,
      correctPattern,
      "wrong pitch clip must be acoustically distinguishable from the correct clip",
    );
  });
});

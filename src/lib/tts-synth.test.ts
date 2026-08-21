// Run: node --import ./src/lib/conjugate/test-hooks.mjs --test src/lib/tts-synth.test.ts
//
// Only `wrongDownstepFor` is tested here — everything else in tts-synth.ts
// makes real network calls to a VOICEVOX engine and has no pure surface to
// pin. See src/lib/pitch-quiz.test.ts and src/data/pitch-pairs.test.ts for
// the rest of SAK-128's pitch-quiz logic.

import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { wrongDownstepFor } from "./tts-synth.ts";

describe("wrongDownstepFor — SAK-128's synthetic wrong-pitch distractor pattern", () => {
  test("heiban (0) gets atamadaka (1)", () => {
    assert.equal(wrongDownstepFor(0, 4), 1);
  });

  test("anything else gets heiban (0)", () => {
    assert.equal(wrongDownstepFor(1, 4), 0);
    assert.equal(wrongDownstepFor(2, 4), 0);
    assert.equal(wrongDownstepFor(3, 4), 0);
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
});

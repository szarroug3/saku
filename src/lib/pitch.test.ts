// Run: node --import ./src/lib/conjugate/test-hooks.mjs --test src/lib/pitch.test.ts
//
// A wrong downstep taught as fact is worse than no pitch at all, so these pin
// the notation as CLAIMS about known words: the textbook minimal set 箸/橋/端,
// the ame pair, 先生, plus mora-counting on a yōon. They also pin the two things
// the owner insisted on — a word with no data shows NO mark (never a default),
// and homographs get distinct patterns.

import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { wordPitch } from "../data/pitch.ts";
import {
  accentName,
  moraeOf,
  pitchPattern,
  pitchPatternForLength,
  wrongDownstepFor,
} from "./pitch.ts";

/** Compact "H"/"L" string of the pattern, and where the drop sits. */
function shape(reading: string, downstep: number) {
  const p = pitchPattern(reading, downstep);
  return {
    hl: p.map((m) => (m.high ? "H" : "L")).join(""),
    dropAt: p.findIndex((m) => m.drop), // -1 when no drop
    morae: p.map((m) => m.text),
  };
}

describe("moraeOf — small kana bind to the mora before them", () => {
  test("せんせい is four morae", () => {
    assert.deepEqual(moraeOf("せんせい"), ["せ", "ん", "せ", "い"]);
  });
  test("きょう is two morae, not three", () => {
    assert.deepEqual(moraeOf("きょう"), ["きょ", "う"]);
  });
  test("っ, ん and ー are morae of their own", () => {
    assert.deepEqual(moraeOf("がっこう"), ["が", "っ", "こう".slice(0, 1), "う"]);
    assert.deepEqual(moraeOf("ラーメン"), ["ラ", "ー", "メ", "ン"]);
  });
  test("empty string yields no morae", () => {
    assert.deepEqual(moraeOf(""), []);
  });
});

describe("pitchPattern — the textbook minimal set", () => {
  test("箸 はし atamadaka [1]: high then low, drop after mora 1", () => {
    assert.deepEqual(shape("はし", 1), { hl: "HL", dropAt: 0, morae: ["は", "し"] });
  });
  test("橋 はし odaka [2]: low then high, drop after mora 2", () => {
    assert.deepEqual(shape("はし", 2), { hl: "LH", dropAt: 1, morae: ["は", "し"] });
  });
  test("端 はし heiban [0]: low then high, NO drop", () => {
    assert.deepEqual(shape("はし", 0), { hl: "LH", dropAt: -1, morae: ["は", "し"] });
  });
  test("雨 あめ atamadaka [1] and 飴 あめ heiban [0] differ", () => {
    assert.equal(shape("あめ", 1).hl, "HL");
    assert.equal(shape("あめ", 0).hl, "LH");
  });
  test("先生 せんせい [3]: low, high, high, then drop after mora 3", () => {
    assert.deepEqual(shape("せんせい", 3), {
      hl: "LHHL",
      dropAt: 2,
      morae: ["せ", "ん", "せ", "い"],
    });
  });
  test("heiban stays high to the end regardless of length", () => {
    assert.equal(shape("にほんご", 0).hl, "LHHH");
  });
  test("downstep counts morae, not characters (きょう [1])", () => {
    // Drop is after the first MORA きょ, so the う is low.
    assert.deepEqual(shape("きょう", 1), { hl: "HL", dropAt: 0, morae: ["きょ", "う"] });
  });
  test("out-of-range downstep never throws and yields no drop", () => {
    assert.equal(shape("はし", 9).dropAt, -1);
  });
});

describe("pitchPatternForLength — downstep collapse past word end", () => {
  test("downstep === length (true odaka) and downstep > length render IDENTICAL high/low", () => {
    // Both a genuine odaka word and any downstep beyond the word's own mora
    // count produce the same LOW,HIGH,HIGH,HIGH shape for a 4-mora word,
    // because `high(i)` only ever checks `pos <= downstep` — nothing here
    // reads how far past `length` the downstep sits. `.drop` is the only
    // field that would distinguish them, and synthesizeAtDownstep (tts-
    // synth.ts) never reads `.drop`, only `.high` — so audio synthesized at
    // downstep === length is acoustically indistinguishable from audio at
    // any downstep > length. This is why `wrongDownstepFor` must never pick
    // a downstep >= the word's own mora count when it wants a distractor
    // that actually SOUNDS different from a same-length real word's clip.
    const asHl = (p: { high: boolean }[]) => p.map((m) => (m.high ? "H" : "L")).join("");
    const odaka = pitchPatternForLength(4, 4);
    const pastEnd = pitchPatternForLength(4, 5);
    const wayPastEnd = pitchPatternForLength(4, 9);
    assert.equal(asHl(odaka), "LHHH");
    assert.equal(asHl(pastEnd), "LHHH");
    assert.equal(asHl(wayPastEnd), "LHHH");
    assert.equal(asHl(odaka), asHl(pastEnd));
    assert.equal(asHl(odaka), asHl(wayPastEnd));
  });
});

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

    const correctPattern = pitchPatternForLength(moraCount, correct).map((m) => m.high);
    const wrongPattern = pitchPatternForLength(moraCount, wrong as number).map((m) => m.high);

    // Sanity: confirm the bug this test guards against is real — heiban (the
    // OLD answer) really is acoustically identical to this odaka pattern.
    const heibanPattern = pitchPatternForLength(moraCount, 0).map((m) => m.high);
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

describe("accentName", () => {
  test("classes are named", () => {
    assert.match(accentName(0), /heiban/);
    assert.match(accentName(1), /atamadaka/);
    assert.match(accentName(3), /mora 3/);
  });
});

describe("wordPitch — real data, the owner's two rules", () => {
  test("verified words carry their known downstep", () => {
    assert.equal(wordPitch("先生"), 3);
    assert.equal(wordPitch("箸"), 1);
    assert.equal(wordPitch("橋"), 2);
  });
  test("homographs 箸 and 橋 get DISTINCT pitch", () => {
    assert.notEqual(wordPitch("箸"), wordPitch("橋"));
  });
  test("a word with no verified pitch returns null, never a default", () => {
    assert.equal(wordPitch("この-word-does-not-exist"), null);
  });
});

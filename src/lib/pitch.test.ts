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
import { accentName, moraeOf, pitchPattern } from "./pitch.ts";

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

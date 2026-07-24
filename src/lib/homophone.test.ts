// Run:
//   node --import ./src/lib/conjugate/test-hooks.mjs --test src/lib/homophone.test.ts
//
// HOMOPHONE COLLISION — a word's reading is shared by another word the learner
// knows, so a meaning question that hides the written form has two right answers.
//
// The fixtures are the classic reading class: 箸 (chopsticks), 橋 (bridge) and
// 端 (edge) all read はし and all ship in the vocabulary. What is pinned here is
// (a) the detector fires only when the OTHER word is known, not merely present;
// (b) it is reading equality, not pitch — 箸 and 橋 have different pitch and still
// collide; and (c) the card decision blocks a colliding word's MEANING card
// (its listening showing) and leaves its reading card and every non-colliding
// word alone.

import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  collidesWithKnown,
  homophonesOf,
  meaningMustShowGlyph,
  readingSharedByKnownWord,
} from "./homophone.ts";
import { meaningFactId } from "../data/kanji.ts";
import {
  vocabRow,
  wordMeaningFactId,
  wordReadingFactId,
} from "../data/vocab.ts";
import { wordPitch } from "../data/pitch.ts";
import type { HistoryFile } from "../types/index.ts";

const NOW = 1_700_000_000_000;

/** A learner who has CLAIMED these words and nothing else — the same "known"
 * route readable.test.ts uses, since `wordKnown` reads exactly this. */
function claiming(...kebs: string[]): HistoryFile {
  return {
    sessions: [],
    facts: {},
    claims: Object.fromEntries(kebs.map((k) => [wordMeaningFactId(k), NOW])),
  };
}

const NOBODY: HistoryFile = { sessions: [], facts: {} };

// Guard the fixtures: if the vocabulary ever drops one of these or splits the
// reading, the tests below would pass vacuously, so assert the setup first.
describe("the はし fixtures are what the tests assume", () => {
  test("箸 橋 端 all exist and all read はし", () => {
    for (const k of ["箸", "橋", "端"]) {
      assert.equal(vocabRow(k)?.reb, "はし", `${k} is not はし`);
    }
  });
});

describe("homophonesOf — the other words that read the same", () => {
  test("箸 lists its reading-mates and never itself", () => {
    const mates = homophonesOf("箸");
    assert.ok(mates.includes("橋"), "橋 is a homophone of 箸");
    assert.ok(mates.includes("端"), "端 is a homophone of 箸");
    assert.ok(!mates.includes("箸"), "a word is not its own homophone");
  });

  test("a word the vocabulary does not have has no homophones", () => {
    assert.deepEqual(homophonesOf("!!not-a-word!!"), []);
  });
});

describe("readingSharedByKnownWord — collision is against the KNOWN set", () => {
  test("箸 collides once 橋 is known", () => {
    assert.equal(readingSharedByKnownWord("箸", claiming("橋")), true);
  });

  test("箸 does not collide when no homophone is known", () => {
    assert.equal(readingSharedByKnownWord("箸", NOBODY), false);
  });

  test("knowing only 箸 itself is not a collision", () => {
    // The word's own knownness is irrelevant — the ambiguity needs a SECOND word
    // reading the same. Claiming 箸 alone leaves はし meaning one thing she knows.
    assert.equal(readingSharedByKnownWord("箸", claiming("箸")), false);
  });

  test("it is reading equality, not pitch — 箸 and 橋 differ in pitch and still collide", () => {
    assert.notEqual(wordPitch("箸"), wordPitch("橋"));
    assert.equal(readingSharedByKnownWord("箸", claiming("橋")), true);
  });
});

describe("collidesWithKnown — the detector, keyed on a fact", () => {
  test("true for either fact of a colliding word", () => {
    const known = claiming("橋");
    assert.equal(collidesWithKnown(wordMeaningFactId("箸"), known), true);
    assert.equal(collidesWithKnown(wordReadingFactId("箸"), known), true);
  });

  test("false for a non-word fact", () => {
    assert.equal(collidesWithKnown(meaningFactId("一"), claiming("橋")), false);
  });
});

describe("meaningMustShowGlyph — the card decision", () => {
  test("a colliding word's MEANING card must show the glyph", () => {
    assert.equal(meaningMustShowGlyph(wordMeaningFactId("箸"), claiming("橋")), true);
  });

  test("a colliding word's READING card need not — the reading is shared, so producing it is fair", () => {
    assert.equal(meaningMustShowGlyph(wordReadingFactId("箸"), claiming("橋")), false);
  });

  test("a non-colliding word's meaning card is untouched", () => {
    assert.equal(meaningMustShowGlyph(wordMeaningFactId("箸"), NOBODY), false);
  });

  test("a non-word fact is untouched", () => {
    assert.equal(meaningMustShowGlyph(meaningFactId("一"), claiming("橋")), false);
  });
});

describe("pitch data — verified vs absent, the overline's on/off switch", () => {
  test("a word with a recorded pitch reports a number", () => {
    // 箸 → 1 (atamadaka). A number is what pitch-mark.tsx renders an overline for.
    assert.equal(typeof wordPitch("箸"), "number");
  });

  test("a word with no recorded pitch reports null, so no mark is drawn", () => {
    assert.equal(wordPitch("!!not-a-word!!"), null);
  });
});

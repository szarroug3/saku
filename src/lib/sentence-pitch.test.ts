// Run: node --import ./src/lib/conjugate/test-hooks.mjs --test src/lib/sentence-pitch.test.ts

import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { wordPitch } from "../data/pitch.ts";
import {
  correctSentencePitch,
  matchPhraseReading,
  toHiragana,
} from "./sentence-pitch.ts";

describe("toHiragana", () => {
  test("shifts the katakana block, leaves everything else alone", () => {
    assert.equal(toHiragana("セ"), "せ");
    assert.equal(toHiragana("センセイ"), "せんせい");
    // ー is shared by both scripts — same code point, no shift.
    assert.equal(toHiragana("ラーメン"), "らーめん");
    assert.equal(toHiragana("hello"), "hello");
  });
});

// お菓子 (おかし, downstep 2) is used here rather than the more familiar 先生
// precisely BECAUSE it is unambiguous: せんせい is ALSO 専制's reading (downstep
// 0), so a real reading-index build correctly drops it as ambiguous — the same
// discipline scripts/ingest/pitch.mjs already applies to a disagreeing
// Kanjium row. お菓子 has no such collision (verified below), so it is the
// fixture that actually exercises the "confident match" path these tests mean
// to cover.
describe("matchPhraseReading — the textbook お菓子 case", () => {
  test("お菓子 has a verified, UNAMBIGUOUS pitch (fixture guard)", () => {
    assert.equal(wordPitch("お菓子"), 2);
  });

  test("おかし (as VOICEVOX's katakana moras) matches the full reading", () => {
    const match = matchPhraseReading(["オ", "カ", "シ"]);
    assert.ok(match);
    assert.equal(match!.matchedLength, 3);
    assert.equal(match!.downstep, 2);
  });

  test("おかしを (word + trailing particle) matches on the shorter prefix", () => {
    const match = matchPhraseReading(["オ", "カ", "シ", "ヲ"]);
    assert.ok(match);
    assert.equal(match!.matchedLength, 3, "matches the word, leaves the particle out");
    assert.equal(match!.downstep, 2);
  });

  test("a genuinely ambiguous reading (せんせい: 先生 vs 専制) is never matched at its FULL length", () => {
    // Both words are verified individually (see pitch.test.ts / the ingest's
    // own conservatism), but they disagree on downstep for the SAME reading,
    // so the sentence-level index must refuse to pick one at length 4 — the
    // exact behaviour a real dictionary-backed match must have. The trimming
    // loop is then free to try shorter prefixes (せんせ, せん, せ), and here
    // せん alone happens to be its own unambiguous word (千/先, downstep 1) —
    // an accepted, rare false positive of a best-effort heuristic, not a bug:
    // see the module header's discussion of this exact trade-off.
    const match = matchPhraseReading(["セ", "ン", "セ", "イ"]);
    assert.ok(match === null || match.matchedLength < 4);
  });

  test("a reading absent from the dataset at every prefix length returns null", () => {
    // Extremely unlikely to collide with any real word or prefix of one.
    assert.equal(matchPhraseReading(["ゾ", "ン", "ビ", "ヌ", "プ"]), null);
  });

  test("an empty phrase returns null, never throws", () => {
    assert.equal(matchPhraseReading([]), null);
  });
});

describe("correctSentencePitch", () => {
  const target = { low: 100, high: 200 };

  test("overwrites a matched phrase's leading morae, leaves the rest untouched", () => {
    const phrases = [
      {
        moras: [
          { text: "オ", pitch: 150 },
          { text: "カ", pitch: 150 },
          { text: "シ", pitch: 150 },
          { text: "ヲ", pitch: 150 }, // trailing particle — not part of the match
        ],
      },
    ];
    const stats = correctSentencePitch(phrases, target);
    assert.equal(stats.totalPhrases, 1);
    assert.equal(stats.matchedPhrases, 1);
    // おかし is downstep 2: L H L (mora 2 is the last high before the drop).
    const pitches = phrases[0].moras.map((m) => m.pitch);
    assert.deepEqual(pitches.slice(0, 3), [target.low, target.high, target.low]);
    // The particle, beyond the matched length, keeps its original pitch.
    assert.equal(pitches[3], 150);
  });

  test("leaves an unmatched phrase's pitch exactly as given", () => {
    const phrases = [{ moras: [{ text: "ゾ", pitch: 77 }, { text: "ン", pitch: 88 }] }];
    const stats = correctSentencePitch(phrases, target);
    assert.equal(stats.matchedPhrases, 0);
    assert.deepEqual(
      phrases[0].moras.map((m) => m.pitch),
      [77, 88],
    );
  });

  test("never edits an already-silent/devoiced mora (pitch <= 0)", () => {
    const phrases = [
      {
        moras: [
          { text: "オ", pitch: 150 },
          { text: "カ", pitch: 0 }, // devoiced — must stay 0
          { text: "シ", pitch: 150 },
        ],
      },
    ];
    correctSentencePitch(phrases, target);
    assert.equal(phrases[0].moras[1].pitch, 0);
  });
});

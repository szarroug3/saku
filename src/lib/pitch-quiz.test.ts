// Run: node --import ./src/lib/conjugate/test-hooks.mjs --test src/lib/pitch-quiz.test.ts

import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { legacyUnqualifiedReading } from "../data/vocab.ts";
import { wordPitch } from "../data/pitch.ts";
import {
  buildPitchShowing,
  gradePitchPick,
  pitchInstruction,
  rollPitchQuestion,
} from "./pitch-quiz.ts";

describe("rollPitchQuestion — which mechanic a word's pitch question uses", () => {
  test("a word with a curriculum homophone partner rolls pair mode", () => {
    const q = rollPitchQuestion("箸", () => 0);
    assert.ok(q);
    assert.equal(q!.mode, "pair");
    assert.ok(q!.partnerKeb === "橋" || q!.partnerKeb === "端");
    assert.equal(q!.downstep, wordPitch("箸"));
    assert.notEqual(q!.partnerDownstep, q!.downstep);
  });

  test("SAK-129: a multi-sense word's gloss agrees with the sense its reading resolves to", () => {
    // 人 has three real senses at the same spelling — ひと "person", じん
    // "-ian/-ite", にん (a counter) — and its base VocabRow happens to be
    // じん's row. legacyUnqualifiedReading("人") correctly resolves to ひと
    // (sense 0, the one wordPitch() was verified against at ingest), so the
    // gloss paired with it must be ひと's gloss too, never じん's.
    const reading = legacyUnqualifiedReading("人");
    assert.equal(reading, "ひと");
    const q = rollPitchQuestion("人");
    assert.ok(q);
    assert.equal(q!.reading, "ひと");
    assert.equal(q!.gloss, "person");
    assert.notEqual(q!.gloss, "-ian (e.g. Italian)");
  });

  test("水 (no curriculum homophone partner) falls back to wrong mode", () => {
    const q = rollPitchQuestion("水");
    assert.ok(q);
    assert.equal(q!.mode, "wrong");
    assert.equal(q!.partnerKeb, null);
    assert.equal(q!.downstep, wordPitch("水"));
  });

  test("a word with no verified pitch offers no question at all", () => {
    assert.equal(rollPitchQuestion("__not_a_word__"), null);
  });

  test("the SAME word always resolves to the SAME mode — never a coin flip", () => {
    for (let i = 0; i < 5; i++) {
      const q = rollPitchQuestion("箸", () => i / 5);
      assert.equal(q!.mode, "pair");
    }
  });
});

describe("buildPitchShowing — turning a decided question into a graded board", () => {
  test("pair mode: two distinct clip URLs, one per word's own downstep", () => {
    const question = rollPitchQuestion("箸", () => 0)!;
    const showing = buildPitchShowing(question, "nana", () => 0);
    assert.equal(showing.mode, "pair");
    assert.equal(showing.promptGloss, question.gloss);
    assert.notEqual(showing.clips[0], showing.clips[1]);
    assert.ok(showing.clips[showing.correct].includes(`d=${question.downstep}`));
  });

  test("wrong mode: both clips are plain pitchApiUrl calls, differing only by downstep", () => {
    const question = rollPitchQuestion("水")!;
    const showing = buildPitchShowing(question, "nana", () => 0);
    assert.equal(showing.mode, "wrong");
    // Same prompt either mode: the learner still needs to be told what word
    // they're judging, even when both clips are nominally the one word.
    assert.equal(showing.promptGloss, question.gloss);
    const correctClip = showing.clips[showing.correct];
    const wrongClip = showing.clips[1 - showing.correct];
    assert.ok(!correctClip.includes("w=1"));
    assert.ok(!wrongClip.includes("w=1"));
    assert.ok(correctClip.includes(`d=${question.downstep}`));
    assert.ok(wrongClip.includes(`d=${question.wrongDownstep}`));
    assert.notEqual(correctClip, wrongClip);
  });

  test("rng controls which slot is correct", () => {
    const question = rollPitchQuestion("水")!;
    const low = buildPitchShowing(question, "nana", () => 0);
    const high = buildPitchShowing(question, "nana", () => 0.99);
    assert.equal(low.correct, 0);
    assert.equal(high.correct, 1);
  });
});

describe("gradePitchPick", () => {
  test("grades by index, not by URL", () => {
    const question = rollPitchQuestion("水")!;
    const showing = buildPitchShowing(question, "nana", () => 0);
    assert.equal(gradePitchPick(showing, showing.correct), true);
    const wrong = showing.correct === 0 ? 1 : 0;
    assert.equal(gradePitchPick(showing, wrong), false);
  });
});

describe("pitchInstruction — same prompt, either mechanic", () => {
  test("pair mode names the word's gloss", () => {
    const question = rollPitchQuestion("箸", () => 0)!;
    const showing = buildPitchShowing(question, "nana", () => 0);
    assert.equal(pitchInstruction(showing), 'Which one means "chopsticks"?');
  });

  test("wrong mode names the SAME word's gloss, not a generic prompt", () => {
    const question = rollPitchQuestion("水")!;
    const showing = buildPitchShowing(question, "nana", () => 0);
    assert.equal(pitchInstruction(showing), `Which one means "${question.gloss}"?`);
  });
});

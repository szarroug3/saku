// Run: node --import ./src/lib/conjugate/test-hooks.mjs --test \
//        src/lib/drill-reveal.test.ts

import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  effectiveListen,
  isRevealPause,
  resolveAnsweredText,
  revealTemplate,
  showsRevealSentence,
} from "@/lib/drill-reveal";

describe("isRevealPause (SAK-50)", () => {
  test("an out-of-retries miss is reveal-eligible", () => {
    assert.equal(isRevealPause({ kind: "bad" }, true), true);
  });

  test("a skip is a deferral, not a resolution — it never reveals, requeued or not", () => {
    assert.equal(isRevealPause({ kind: "skip" }, true), false);
  });

  test("a correct-answer pause never reveals — nothing to compare", () => {
    assert.equal(isRevealPause({ kind: "good" }, true), false);
  });

  test("no pause at all (still answering, or no feedback yet) never reveals", () => {
    assert.equal(isRevealPause({ kind: "bad" }, false), false);
    assert.equal(isRevealPause({ kind: "skip" }, false), false);
    assert.equal(isRevealPause(null, true), false);
    assert.equal(isRevealPause(undefined, true), false);
  });
});

describe("resolveAnsweredText (SAK-50)", () => {
  test("prefers a recognition pick over an MC label over typed text", () => {
    assert.equal(
      resolveAnsweredText({
        recognitionSaid: "the sentence's meaning",
        mcSaid: "an MC label",
        typedSaid: "typed text",
      }),
      "the sentence's meaning",
    );
    assert.equal(
      resolveAnsweredText({ mcSaid: "an MC label", typedSaid: "typed text" }),
      "an MC label",
    );
    assert.equal(resolveAnsweredText({ typedSaid: "o" }), "o");
  });

  test("nothing said (timeout, or a skip before any attempt) is null, not a blank string", () => {
    assert.equal(resolveAnsweredText({}), null);
    assert.equal(
      resolveAnsweredText({
        recognitionSaid: null,
        mcSaid: null,
        typedSaid: null,
      }),
      null,
    );
  });
});

describe("revealTemplate (SAK-50 changes-requested pass)", () => {
  test("a meaning-type question is framed as what it means, even if it also reads as sound-ish", () => {
    assert.deepEqual(revealTemplate({ isSound: true, isMeaning: true }), {
      prefix: "This means ",
      suffix: ".",
    });
  });

  test("a reading-type question is framed as how it's said", () => {
    assert.deepEqual(revealTemplate({ isSound: true, isMeaning: false }), {
      prefix: 'This is said "',
      suffix: '".',
    });
  });

  test("neither reading nor meaning falls back to a plain, honest frame", () => {
    assert.deepEqual(revealTemplate({ isSound: false, isMeaning: false }), {
      prefix: "The answer is ",
      suffix: ".",
    });
  });
});

describe("showsRevealSentence (SAK-194 changes-requested)", () => {
  test("a derivation hint suppresses the sentence — its own lead line carries that job", () => {
    assert.equal(showsRevealSentence("derivation"), false);
  });

  test("every other hint kind keeps the sentence", () => {
    assert.equal(showsRevealSentence("image"), true);
    assert.equal(showsRevealSentence("formula"), true);
    assert.equal(showsRevealSentence("written"), true);
    assert.equal(showsRevealSentence("text"), true);
  });

  test("a card with no hint at all keeps the sentence too", () => {
    assert.equal(showsRevealSentence(null), true);
    assert.equal(showsRevealSentence(undefined), true);
  });
});

describe("effectiveListen (SAK-51)", () => {
  test("a fresh audio-prompt card still hides its glyph behind the speaker", () => {
    assert.equal(effectiveListen(true, false), true);
  });

  test("Show text drops the glyph's hiding, without touching a non-listening card", () => {
    assert.equal(effectiveListen(true, true), false);
    assert.equal(effectiveListen(false, true), false);
    assert.equal(effectiveListen(false, false), false);
  });
});

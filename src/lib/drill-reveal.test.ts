// Run: node --import ./src/lib/conjugate/test-hooks.mjs --test \
//        src/lib/drill-reveal.test.ts

import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  effectiveListen,
  isRevealPause,
  resolveAnsweredText,
} from "@/lib/drill-reveal";

describe("isRevealPause (SAK-50)", () => {
  test("a skip pause is reveal-eligible, same as an out-of-retries miss", () => {
    assert.equal(isRevealPause({ kind: "skip" }, true), true);
    assert.equal(isRevealPause({ kind: "bad" }, true), true);
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

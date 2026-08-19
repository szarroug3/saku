// Run:
//   node --import ./src/lib/conjugate/test-hooks.mjs --test src/lib/srs-intro-copy.test.ts
//
// Pins the five required-content items from the owner's Linear review (SAK-27)
// against the actual copy, plus the no-em-dash rule the whole feature was
// reviewed under.

import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  SRS_INTRO_LINK_HREF,
  SRS_INTRO_LINK_LABEL,
  SRS_INTRO_LINK_TEXT,
  SRS_INTRO_PARAGRAPHS,
} from "./srs-intro-copy";
import { CONCEPT_CARD_IDS, isIntroShown, markIntroShown } from "./intro-shown";

const ALL_TEXT = [...SRS_INTRO_PARAGRAPHS, SRS_INTRO_LINK_TEXT, SRS_INTRO_LINK_LABEL].join(
  "\n",
);

describe("no em dashes in the intro copy", () => {
  test("the owner's explicit instruction", () => {
    for (const p of SRS_INTRO_PARAGRAPHS) {
      assert.ok(!p.includes("—"), `em dash found in: "${p}"`);
    }
    assert.ok(!SRS_INTRO_LINK_TEXT.includes("—"));
  });
});

describe("the required content is actually here", () => {
  test("names spaced repetition or SRS explicitly", () => {
    assert.match(ALL_TEXT, /spaced repetition/i);
    assert.match(ALL_TEXT, /\bSRS\b/);
  });

  test("explains spacing plus later recall as the mechanism", () => {
    assert.match(ALL_TEXT, /increasing intervals/i);
    assert.match(ALL_TEXT, /recall/i);
  });

  test("encourages genuine effort before hints or skipping", () => {
    assert.match(ALL_TEXT, /hint/i);
    assert.match(ALL_TEXT, /skip/i);
    assert.match(ALL_TEXT, /burns it into memory/i);
  });

  test("explains the 3-round structure", () => {
    assert.match(ALL_TEXT, /three rounds/i);
  });

  test("mentions the break time is adjustable in Settings (confirmed true)", () => {
    assert.match(ALL_TEXT, /5 minutes before round 2/);
    assert.match(ALL_TEXT, /10 minutes before round 3/);
    assert.match(ALL_TEXT, /adjustable in Settings/);
  });

  test("links to the How Saku works reference page", () => {
    assert.equal(SRS_INTRO_LINK_HREF, "/how-it-works");
    assert.equal(SRS_INTRO_LINK_LABEL, "How Saku works");
  });
});

describe("the intro rides the shared once-ever-intro registry", () => {
  test("intro-srs is registered, so it gets the server sync and reset sweep for free", () => {
    assert.ok(CONCEPT_CARD_IDS.includes("intro-srs"));
  });

  test("shown once, it stays shown (the same contract every concept card gets)", () => {
    function fakeStore(initial: Record<string, string> = {}) {
      const map = new Map(Object.entries(initial));
      return {
        getItem: (k: string) => (map.has(k) ? map.get(k)! : null),
        setItem: (k: string, v: string) => void map.set(k, v),
      };
    }
    const store = fakeStore();
    assert.equal(isIntroShown(store, "intro-srs"), false);
    markIntroShown(store, "intro-srs");
    assert.equal(isIntroShown(store, "intro-srs"), true);
  });
});

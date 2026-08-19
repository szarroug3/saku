// Run: node --import ./src/lib/conjugate/test-hooks.mjs --test \
//        src/lib/sentence-ordering-plan.test.ts
//
// The sentence-ordering PLANNER, tested at its gates. These functions used to
// live inside home-feed.tsx where only the component could exercise them; lifted
// into lib, the contract can be asserted directly: the kana front door, the
// linear lock at tier one, and the marker fallback when a tier has no example.

import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  nextSentenceOrderingLesson,
  sentenceLessonFacts,
} from "./sentence-ordering-plan.ts";
import { SENTENCE_ORDERING_TIERS, type AssemblyTier } from "../data/assembly.ts";
import { sentenceTierMarkerFact } from "./sentence-ordering-progress.ts";
import { patternMeaningFactId } from "../data/grammar/index.ts";
import { applyClaims, emptyHistory } from "./history-ops.ts";
import type { HistoryFile } from "../types/index.ts";

const EMPTY: HistoryFile = { sessions: [], facts: {} };

describe("nextSentenceOrderingLesson", () => {
  test("offers nothing until kana is complete", () => {
    // The kana gate is the track's front door: no sentence work before the
    // syllabaries, regardless of what else the history holds.
    assert.equal(nextSentenceOrderingLesson(false, EMPTY), null);
  });

  test("stays locked when the first tier's grammar prereq isn't taught yet", () => {
    // The track is linear: an empty history has met neither of the first
    // tier's grammar prereqs (wa/ga), so the walk stops at tier one rather
    // than skipping ahead. The tier's structural pool alone is not enough
    // (SAK-87 round 5 dropped the vocabulary-known half of this gate).
    assert.equal(nextSentenceOrderingLesson(true, EMPTY), null);
  });

  // SAK-87 round 5 dropped the vocabulary-known half of the tier-unlock gate:
  // a tier's structural pool (piece count, tier match, curated + generated
  // items) is available regardless of history, so only the grammar-prereq
  // ANY-of check below is left to exercise.
  test("opens Simple once one of wa/ga is taught, with no vocabulary claimed", () => {
    const history = applyClaims(emptyHistory(), [patternMeaningFactId("wa")], 1);
    assert.equal(nextSentenceOrderingLesson(true, history)?.tierId, "simple");
  });

  test("later tiers need their own grammar lesson, not just the earlier tier's", () => {
    let history = applyClaims(
      emptyHistory(),
      [patternMeaningFactId("wa"), sentenceTierMarkerFact("simple")],
      1,
    );
    assert.equal(nextSentenceOrderingLesson(true, history), null);

    history = applyClaims(history, [patternMeaningFactId("te-kara")], 2);
    assert.equal(nextSentenceOrderingLesson(true, history)?.tierId, "sequential");
  });
});

describe("sentenceLessonFacts", () => {
  // SAK-87 round 5 dropped the vocab-known gate, so a real tier's pool no
  // longer empties out for a learner who has claimed nothing: real tiers
  // now resolve real facts even against EMPTY history (see
  // nextSentenceOrderingLesson's tests above). The marker fallback still
  // exists for the other case sentenceLessonFacts documents: a tier whose
  // pool genuinely has no items to credit facts from, modeled here with a
  // tier id no assembly item is tagged with.
  test("falls back to the tier marker when the tier's pool credits no facts", () => {
    const emptyTier: AssemblyTier = {
      id: "sak-87-test-empty-tier",
      label: "Test tier with no matching items",
      patterns: ["sak-87-test-pattern-nobody-tags"],
      minReadable: 0,
      grammarPrereqs: [],
    };
    assert.deepEqual(sentenceLessonFacts(emptyTier, EMPTY), [
      sentenceTierMarkerFact(emptyTier.id),
    ]);
  });

  test("a real tier resolves real facts even against EMPTY history", () => {
    const simple = SENTENCE_ORDERING_TIERS[0];
    const facts = sentenceLessonFacts(simple, EMPTY);
    assert.ok(facts.length > 0);
    assert.ok(!facts.includes(sentenceTierMarkerFact(simple.id)));
  });
});

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
import { SENTENCE_ORDERING_TIERS } from "../data/assembly.ts";
import { sentenceTierMarkerFact } from "./sentence-ordering-progress.ts";
import { wordMeaningFactId } from "../data/vocab.ts";
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

  test("stays locked when the first tier has no readable material", () => {
    // The track is linear: an empty history cannot meet the first tier's
    // minReadable, so the walk stops at tier one rather than skipping ahead.
    assert.equal(nextSentenceOrderingLesson(true, EMPTY), null);
  });

  // The curated "Simple sentences" items (SAK-45) no longer draw from the
  // first N Vocabulary-track words by curriculum rank — Sam's approved copy
  // is natural, imitable content, not rank-ordered filler (see assembly.ts).
  // These tests claim exactly the words those curated items need, rather than
  // a CURRICULUM_WORDS slice, so the assertion still expresses "a small
  // vocabulary foundation, not the whole track" without depending on where
  // those specific words happen to fall in curriculum rank.
  const SIMPLE_TIER_WORDS = ["私", "水", "飲む", "何", "本", "読む"];
  const SEQUENTIAL_TIER_WORDS = ["宿題", "忘れる", "新しい", "料理", "食べる", "傘", "持つ"];

  test("opens Simple after a small vocabulary foundation and one of wa/ga", () => {
    const history = applyClaims(
      emptyHistory(),
      [...SIMPLE_TIER_WORDS.map(wordMeaningFactId), patternMeaningFactId("wa")],
      1,
    );
    assert.equal(nextSentenceOrderingLesson(true, history)?.tierId, "simple");
  });

  test("Simple stays locked on vocabulary alone, needing wa or ga taught first", () => {
    const history = applyClaims(
      emptyHistory(),
      SIMPLE_TIER_WORDS.map(wordMeaningFactId),
      1,
    );
    assert.equal(nextSentenceOrderingLesson(true, history), null);
  });

  test("later tiers need their grammar lesson, not hundreds of matching words", () => {
    let history = applyClaims(
      emptyHistory(),
      [
        ...[...SIMPLE_TIER_WORDS, ...SEQUENTIAL_TIER_WORDS].map(wordMeaningFactId),
        patternMeaningFactId("wa"),
        sentenceTierMarkerFact("simple"),
      ],
      1,
    );
    assert.equal(nextSentenceOrderingLesson(true, history), null);

    history = applyClaims(history, [patternMeaningFactId("te-kara")], 2);
    assert.equal(nextSentenceOrderingLesson(true, history)?.tierId, "sequential");
  });
});

describe("sentenceLessonFacts", () => {
  test("falls back to the tier marker when no example fact resolves", () => {
    // With nothing learned, a tier has no readable examples to mint facts from,
    // so it surfaces its marker fact — the thing that still lets the tier be
    // shown and completed.
    const simple = SENTENCE_ORDERING_TIERS[0];
    assert.deepEqual(sentenceLessonFacts(simple, EMPTY), [
      sentenceTierMarkerFact(simple.id),
    ]);
  });
});

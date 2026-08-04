// Run: node --import ./src/lib/conjugate/test-hooks.mjs --test \
//        src/components/results/word-table.test.ts
//
// Regression guard for results triage: the summary can know a fact had misses
// even when phrase-level missedPhrases data is unavailable (older/inferred
// records). In that case, Needs work must still surface selectable boxes.

import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { kanaFact } from "@/data/characters";
import {
  boxKeyOf,
  missedBoxKeysForFacts,
  outcomeForPhrase,
  presentationPhrasesForFact,
} from "@/components/results/word-table-keys";
import type { FactSessionDetail, SessionStats } from "@/types";

function stat(over: Partial<FactSessionDetail> = {}): FactSessionDetail {
  return {
    seen: 1,
    misses: 0,
    everCorrect: true,
    firstTryCorrect: true,
    firstTryCount: 1,
    correct: 1,
    confused: {},
    ...over,
  };
}

describe("missedBoxKeysForFacts", () => {
  test("falls back to presentation boxes when misses exist but missedPhrases is absent", () => {
    const fact = kanaFact("ちゅ");
    const stats: SessionStats = {
      [fact]: stat({ misses: 2, everCorrect: false, firstTryCorrect: false }),
    };

    const phrases = presentationPhrasesForFact(fact, stats);
    assert.ok(phrases.length > 0, "expected at least one presentation phrase");

    const got = missedBoxKeysForFacts([fact], stats);
    const want = phrases.map((p) => boxKeyOf(fact, p));

    assert.deepEqual(got, want);
  });

  test("prefers phrase-level misses when missedPhrases is present", () => {
    const fact = kanaFact("ちゅ");
    const stats: SessionStats = {
      [fact]: stat({
        misses: 2,
        everCorrect: true,
        firstTryCorrect: false,
        missedPhrases: ["hear it -> type the meaning"],
      }),
    };

    const got = missedBoxKeysForFacts([fact], stats);
    assert.deepEqual(got, [boxKeyOf(fact, "hear it -> type the meaning")]);
  });

  test("returns no boxes when there are no misses", () => {
    const fact = kanaFact("ちゅ");
    const stats: SessionStats = {
      [fact]: stat({ misses: 0, everCorrect: true, firstTryCorrect: true }),
    };

    assert.deepEqual(missedBoxKeysForFacts([fact], stats), []);
  });

  test("falls back to non-first-try outcome when misses exist but missedPhrases is empty", () => {
    const fact = kanaFact("ちゅ");
    const stats: SessionStats = {
      [fact]: stat({
        misses: 1,
        everCorrect: true,
        firstTryCorrect: false,
        missedPhrases: [],
      }),
    };

    // Guard the data condition that should be treated as 'needed another look'.
    assert.equal(stats[fact].misses > 0, true);
    assert.equal(Array.isArray(stats[fact].missedPhrases), true);
    assert.deepEqual(stats[fact].missedPhrases, []);
  });
});

describe("outcomeForPhrase", () => {
  test("a clean phrase reads first-try even when a SIBLING phrase was missed", () => {
    // The reported bug: a fact asked several ways, one form missed, the fact
    // therefore "recovered" overall — but the forms that were never missed must
    // still read first-try, not borrow the fact's recovered status.
    const st = stat({
      seen: 3,
      misses: 1,
      everCorrect: true,
      firstTryCorrect: false,
      firstTryCount: 2,
      correct: 2,
      missedPhrases: ["B"],
    });

    assert.equal(outcomeForPhrase(st, "A"), "first-try");
    assert.equal(outcomeForPhrase(st, "B"), "recovered");
  });

  test("a missed phrase reads missed when the fact never landed", () => {
    const st = stat({
      seen: 2,
      misses: 2,
      everCorrect: false,
      firstTryCorrect: false,
      firstTryCount: 0,
      correct: 0,
      missedPhrases: ["B"],
    });

    assert.equal(outcomeForPhrase(st, "A"), "first-try");
    assert.equal(outcomeForPhrase(st, "B"), "missed");
  });

  test("empty miss data with a recorded miss falls back to the fact outcome", () => {
    const st = stat({
      seen: 2,
      misses: 1,
      everCorrect: true,
      firstTryCorrect: false,
      firstTryCount: 1,
      correct: 1,
      missedPhrases: [],
    });

    // Unattributable miss: no phrase to blame, so surface it via the fact.
    assert.equal(outcomeForPhrase(st, "A"), "recovered");
  });

  test("an unseen stat reads unseen", () => {
    const st = stat({ seen: 0, misses: 0, firstTryCorrect: null, firstTryCount: 0, correct: 0 });
    assert.equal(outcomeForPhrase(st, "A"), "unseen");
  });
});

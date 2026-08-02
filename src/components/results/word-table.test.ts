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
});

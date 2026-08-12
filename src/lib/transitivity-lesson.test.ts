// Run: node --import ./src/lib/conjugate/test-hooks.mjs --test \
//        src/lib/transitivity-lesson.test.ts
//
// WHAT THESE PIN
// ==============
// The transitivity curriculum has properties that all type-check when broken:
//
//   IN CURRICULUM  it teaches only pairs whose BOTH verbs the app teaches, so a
//                  pair can never be gated behind a verb that never unlocks.
//   ORDER          pairs are taught in word-curriculum order.

import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { CURRICULUM_PAIRS } from "./transitivity-lesson.ts";
import { VERB_PAIRS } from "../data/transitivity.ts";
import { CURRICULUM_WORDS } from "./word-lesson.ts";

describe("the track is the pairs whose both verbs the app teaches", () => {
  const kebs = new Set(CURRICULUM_WORDS.map((w) => w.keb));

  test("every curriculum pair has both verbs in the words curriculum", () => {
    for (const p of CURRICULUM_PAIRS) {
      assert.ok(kebs.has(p.happens.word), `${p.happens.word} not taught`);
      assert.ok(kebs.has(p.doIt.word), `${p.doIt.word} not taught`);
    }
  });

  test("a pair with a verb outside the curriculum is excluded", () => {
    const excluded = VERB_PAIRS.filter(
      (p) => !kebs.has(p.happens.word) || !kebs.has(p.doIt.word),
    );
    for (const p of excluded) {
      assert.ok(!CURRICULUM_PAIRS.includes(p));
    }
  });
});

describe("teaching order follows curriculum word order", () => {
  const wordRank = new Map(CURRICULUM_WORDS.map((w) => [w.keb, w.beginnerRank]));
  const pairRank = (p: (typeof CURRICULUM_PAIRS)[number]) =>
    Math.min(
      wordRank.get(p.happens.word) ?? Infinity,
      wordRank.get(p.doIt.word) ?? Infinity,
    );

  test("pairs are sorted by the minimum beginnerRank of their two verbs", () => {
    for (let i = 1; i < CURRICULUM_PAIRS.length; i++) {
      const prev = CURRICULUM_PAIRS[i - 1];
      const curr = CURRICULUM_PAIRS[i];
      assert.ok(
        pairRank(prev) <= pairRank(curr),
        `"${prev.happens.word}/${prev.doIt.word}" (rank ${pairRank(prev)}) should come before "${curr.happens.word}/${curr.doIt.word}" (rank ${pairRank(curr)})`,
      );
    }
  });
});

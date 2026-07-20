// Run: node --import ./src/lib/conjugate/test-hooks.mjs --test \
//        src/lib/transitivity-pattern.test.ts
//
// WHAT THESE TESTS ARE FOR
// ========================
// pairPattern DESCRIBES a pair's ending swap; it must never over-claim. Two
// guarantees matter:
//
//   RULE      — each labelled swap catches the shapes it is meant to and reports
//               the right tails, including the one reverse shape (-える → -く)
//               and the same-column -す shapes that a naive romaji check misses.
//   HONESTY   — a pair with no shared reading stem, or a tail shift outside the
//               rule set, is marked an exception rather than forced into a rule.
//
// The whole-curriculum check pins the distribution so a future edit to the rules
// or the pair table cannot silently start mislabelling cards.

import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { pairPattern } from "./transitivity-pattern.ts";
import { CURRICULUM_PAIRS } from "./transitivity-lesson.ts";

describe("pairPattern rules", () => {
  const cases: Array<[string, string, string, string, string]> = [
    // happens, doIt, id, from, to
    ["はじまる", "はじめる", "A", "-ある", "-える"],
    ["あく", "あける", "B", "-う", "-える"],
    ["なおる", "なおす", "E", "-る", "-す"],
    ["やける", "やく", "I", "-える", "-く"],
  ];
  for (const [happens, doIt, id, from, to] of cases) {
    test(`${happens} / ${doIt} is ${id}`, () => {
      const p = pairPattern(happens, doIt);
      assert.equal(p.id, id);
      assert.equal(p.from, from);
      assert.equal(p.to, to);
      assert.equal(p.isException, false);
    });
  }
});

describe("pairPattern exceptions", () => {
  // No shared reading stem (で vs だ), and a tail shift no rule covers (乗る/乗せる).
  for (const [happens, doIt] of [["でる", "だす"], ["のる", "のせる"]]) {
    test(`${happens} / ${doIt} is an exception`, () => {
      const p = pairPattern(happens, doIt);
      assert.equal(p.isException, true);
      assert.equal(p.from, null);
      assert.equal(p.to, null);
    });
  }
});

describe("pairPattern over the curriculum", () => {
  test("labels every pair and front-loads the 6 exceptions", () => {
    const exceptions = CURRICULUM_PAIRS.flatMap((p, i) =>
      pairPattern(p.happens.reading, p.doIt.reading).isException ? [i + 1] : [],
    );
    assert.deepEqual(exceptions, [5, 6, 8, 31, 52, 65]);
  });

  test("the three dominant rules cover most pairs", () => {
    const counts: Record<string, number> = {};
    for (const p of CURRICULUM_PAIRS) {
      const id = pairPattern(p.happens.reading, p.doIt.reading).id;
      counts[id] = (counts[id] ?? 0) + 1;
    }
    assert.equal(counts.A, 17); // -ある → -える
    assert.equal(counts.E, 11); // -る → -す
    assert.equal(counts.B, 9); //  -う → -える
    assert.equal(counts.exception, 6);
  });
});

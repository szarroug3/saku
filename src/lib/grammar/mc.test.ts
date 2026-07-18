// Run:
//   node --import ./src/lib/conjugate/test-hooks.mjs --test src/lib/grammar/mc.test.ts
//
// The MC seam normalises two generators (selection, transitivity) into one
// card. The invariant that matters, for both, is the one the drill's MC control
// relies on: DISTINCT options, EXACTLY ONE correct, and a correctIndex that
// actually points at it after the shuffle. If any of those slips, the drill
// either grades a right answer wrong or hands out a free point.

import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  nextGrammarMc,
  selectionMc,
  selectionMcsFor,
  transitivityMc,
  transitivityMcs,
  type GrammarMc,
} from "./mc";
import type { Rng } from "./vehicles";
import { examplesFor } from "../../data/grammar/corpus";
import { VERB_PAIRS } from "../../data/transitivity";

/** A well-formed card: >=2 distinct labels, a single correct index in range,
 * and the answer string agreeing with the choice that index names. */
function assertWellFormed(mc: GrammarMc) {
  assert.ok(mc.choices.length >= 2, "fewer than two choices");
  // Distinct to the USER: a pattern's gloss sub-line disambiguates two options
  // that render the same string (〜て "and then" vs 〜て "because"), which is the
  // te-family's whole point and the "distinct gloss" guarantee selection() ships.
  const keys = mc.choices.map((c) => `${c.label}␟${c.sub ?? ""}`);
  assert.equal(new Set(keys).size, keys.length, `indistinct choices in ${keys.join(" / ")}`);
  assert.ok(
    mc.correctIndex >= 0 && mc.correctIndex < mc.choices.length,
    `correctIndex ${mc.correctIndex} out of range`,
  );
  assert.equal(mc.choices[mc.correctIndex].label, mc.answer, "correctIndex names the wrong choice");
  assert.ok(mc.prompt.length > 0, "empty prompt");
  assert.ok(mc.instruction.length > 0, "empty instruction");
}

/** Deterministic rng from a fixed sequence, for a pinned board. */
function seq(values: number[]): Rng {
  let i = 0;
  return () => values[i++ % values.length];
}

describe("SELECTION as MC — distinct options, exactly one correct (#51)", () => {
  const ex = examplesFor("te-kara").find((e) => selectionMc(e, "te-kara") !== null)!;

  test("a te-kara frame yields a well-formed card", () => {
    const mc = selectionMc(ex, "te-kara", seq([0.1, 0.6, 0.3, 0.9]));
    assert.ok(mc);
    assert.equal(mc.kind, "selection");
    assertWellFormed(mc);
    // The correct choice is te-kara's own pattern.
    assert.equal(mc.answer, "〜てから");
    // The blank is in the frame, and the swallowed verb is named beside it.
    assert.ok(mc.prompt.includes("＿＿＿"), `no blank in ${mc.prompt}`);
    assert.ok(mc.host, "the host verb must be named");
  });

  test("the answer moves with the shuffle — it is not always first", () => {
    // Different seeds must be able to place the answer at different indices,
    // or the board would leak the answer's position.
    const seeds = [[0.9, 0.1], [0.1, 0.9], [0.5, 0.5], [0.0, 0.99]];
    const positions = new Set(
      seeds.map((s) => selectionMc(ex, "te-kara", seq(s))?.correctIndex),
    );
    assert.ok(positions.size >= 2, "the answer never moves — shuffle is inert");
  });

  test("every selection MC across the corpus is internally sound", () => {
    let n = 0;
    for (const id of ["te-kara", "nagara", "tara", "temo"]) {
      for (const mc of selectionMcsFor(id, seq([0.3, 0.7, 0.1, 0.5]))) {
        assertWellFormed(mc);
        n++;
      }
    }
    assert.ok(n > 0, "no selection MC was produced at all");
  });
});

describe("TRANSITIVITY as MC — the pair, one cue, one answer (#51)", () => {
  test("a pair produces a well-formed two-option card", () => {
    const pair = VERB_PAIRS[0]; // 開く / 開ける
    const mc = transitivityMc(pair, "doIt", seq([0.9]));
    assert.ok(mc);
    assert.equal(mc.kind, "transitivity");
    assertWellFormed(mc);
    assert.equal(mc.choices.length, 2);
    // The cue shown is the ANSWER side's, and the answer is that side's verb.
    assert.equal(mc.prompt, pair.doIt.en);
    assert.equal(mc.answer, pair.doIt.word);
    // Both members are on the board; the partner is the distractor.
    const labels = mc.choices.map((c) => c.label).sort();
    assert.deepEqual(labels, [pair.happens.word, pair.doIt.word].sort());
  });

  test("both verbs appear as the two options, and only they", () => {
    for (const mc of transitivityMcs(seq([0.2, 0.8]))) {
      assertWellFormed(mc);
      assert.equal(mc.choices.length, 2);
    }
  });

  test("the answer is placed on either side across seeds, not pinned", () => {
    const pair = VERB_PAIRS[0];
    const positions = new Set(
      [[0.0], [0.99], [0.4], [0.6]].map((s) => transitivityMc(pair, "happens", seq(s))?.correctIndex),
    );
    assert.ok(positions.size >= 2, "transitivity answer never moves");
  });
});

describe("the combined seam picks from both sources", () => {
  test("nextGrammarMc always returns a well-formed card", () => {
    // Many seeds, both branches (rng()<0.5 chooses transitivity first).
    for (let i = 0; i < 40; i++) {
      const mc = nextGrammarMc(seq([i / 40, (i * 7) % 40 / 40, 0.3, 0.7, 0.1]));
      assert.ok(mc, `seed ${i} produced nothing`);
      assertWellFormed(mc);
    }
  });

  test("over a run it draws BOTH selection and transitivity items", () => {
    const kinds = new Set<string>();
    for (let i = 0; i < 60; i++) {
      const mc = nextGrammarMc(seq([i / 60, (i * 13) % 60 / 60, i % 7 / 7, 0.5]));
      if (mc) kinds.add(mc.kind);
    }
    assert.deepEqual([...kinds].sort(), ["selection", "transitivity"]);
  });
});

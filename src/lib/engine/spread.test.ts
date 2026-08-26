// Run:
//   node --experimental-strip-types --import ./src/lib/conjugate/test-hooks.mjs \
//        --test src/lib/engine/spread.test.ts
//
// spread()'s two guarantees, each proven separately:
//   1. LOCAL adjacency — no two neighbours share a key, whenever the input is
//      feasible (no key's count exceeds ceil(n/2)); graceful degradation
//      (minimal, not zero, collisions) when it is not.
//   2. GLOBAL distribution — SAK-206: this is the property the OLD greedy
//      algorithm silently lacked. A composition with a few large buckets and
//      many small ones must not front-load the large buckets' category into
//      the first portion of the output. Modelled on the ticket's own
//      synthetic composition and checked with the same kind of statistic the
//      ticket's empirical proof used (fraction of the minority category
//      landing in an early window), not just a single eyeballed run.
//
// A deterministic PRNG (not Math.random) drives every test here so results
// are reproducible and so the distribution test's statistics are exact
// numbers, not wall-clock-random ones — spread()'s injectable `rand` exists
// exactly for this.

import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { spread } from "./spread.ts";

/** mulberry32: a small, fast, seedable PRNG. Deterministic across runs and
 * across machines, unlike Math.random, so a seed reproduces the exact same
 * sequence — what lets the distribution test below report real, stable
 * statistics instead of "whatever this run happened to roll." */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function (): number {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface Tagged {
  key: string;
  cat: string;
  n: number;
}

/** Build `count` items all sharing one key, tagged with a category for the
 * distribution assertions below. */
function bucket(key: string, cat: string, count: number): Tagged[] {
  return Array.from({ length: count }, (_, n) => ({ key, cat, n }));
}

const keyOf = (t: Tagged): string => t.key;

describe("spread — local adjacency", () => {
  test("empty input returns empty", () => {
    assert.deepEqual(spread<Tagged>([], keyOf, mulberry32(1)), []);
  });

  test("single item returns unchanged", () => {
    const items = bucket("a", "x", 1);
    assert.deepEqual(spread(items, keyOf, mulberry32(1)), items);
  });

  test("all-same-key input is returned in full, in some order, with no crash", () => {
    const items = bucket("a", "x", 12);
    const out = spread(items, keyOf, mulberry32(1));
    assert.equal(out.length, items.length);
    assert.deepEqual(
      [...out].sort((a, b) => a.n - b.n),
      [...items].sort((a, b) => a.n - b.n),
    );
  });

  test("a feasible mix of bucket sizes reaches zero adjacent same-key pairs, across many seeds", () => {
    // 8 buckets of varied size, none exceeding ceil(n/2) — a solved case.
    const items = [
      ...bucket("a", "x", 6),
      ...bucket("b", "x", 5),
      ...bucket("c", "y", 4),
      ...bucket("d", "y", 3),
      ...bucket("e", "z", 2),
      ...bucket("f", "z", 2),
      ...bucket("g", "z", 1),
      ...bucket("h", "z", 1),
    ]; // n = 24, max bucket 6 <= ceil(24/2) = 12
    for (let seed = 0; seed < 30; seed++) {
      const out = spread(items, keyOf, mulberry32(seed * 104729 + 7));
      // Still a permutation — nothing added, dropped, or duplicated.
      assert.deepEqual(
        [...out].sort((a, b) => a.key.localeCompare(b.key) || a.n - b.n),
        [...items].sort((a, b) => a.key.localeCompare(b.key) || a.n - b.n),
      );
      for (let i = 1; i < out.length; i++) {
        assert.notEqual(
          out[i]!.key,
          out[i - 1]!.key,
          `seed ${seed}: positions ${i - 1}/${i} share key ${out[i]!.key}`,
        );
      }
    }
  });

  test("a bucket at exactly the ceil(n/2) feasibility bound still reaches zero collisions", () => {
    // n = 9, ceil(9/2) = 5: the majority key is AT the bound, the sharpest
    // feasible case (one item over this and it becomes provably infeasible).
    const items = [...bucket("majority", "x", 5), ...bucket("b", "y", 1), ...bucket("c", "y", 1), ...bucket("d", "y", 1), ...bucket("e", "y", 1)];
    for (let seed = 0; seed < 30; seed++) {
      const out = spread(items, keyOf, mulberry32(seed * 65537 + 3));
      for (let i = 1; i < out.length; i++) {
        assert.notEqual(out[i]!.key, out[i - 1]!.key, `seed ${seed}: bound case produced an adjacent collision`);
      }
    }
  });

  test("infeasible input (one key over ceil(n/2)) degrades to the minimum forced collisions, not more", () => {
    // n = 5, key "a" has 4 items — exceeds ceil(5/2) = 3 by 1. The minimum
    // achievable adjacent-same-key count for a bucket this far over the bound
    // is 2*count - n - 1 = 2*4 - 5 - 1 = 2 (splitting the 4 around the single
    // "b" item still leaves two forced same-key touches).
    const items = [...bucket("a", "x", 4), ...bucket("b", "y", 1)];
    for (let seed = 0; seed < 30; seed++) {
      const out = spread(items, keyOf, mulberry32(seed * 7 + 1));
      assert.equal(out.length, 5, "no cards dropped");
      assert.deepEqual(
        [...out].sort((a, b) => a.key.localeCompare(b.key) || a.n - b.n),
        [...items].sort((a, b) => a.key.localeCompare(b.key) || a.n - b.n),
      );
      let collisions = 0;
      for (let i = 1; i < out.length; i++) {
        if (out[i]!.key === out[i - 1]!.key) collisions++;
      }
      assert.equal(collisions, 2, `seed ${seed}: expected exactly the forced minimum of 2 collisions, got ${collisions}`);
    }
  });
});

describe("spread — global distribution (SAK-206)", () => {
  // Mirrors the ticket's own ad hoc simulation: 30 "grammar" buckets sized
  // 5-15 each (a category of many multi-item buckets, modelling grammar
  // production's one-fact-per-conjugation-class shape) against 80 "other"
  // buckets mostly size 1-2 (modelling the mostly-singleton kana/word
  // entries they got mixed with in Sam's reported session).
  function buildComposition(rand: () => number): Tagged[] {
    const items: Tagged[] = [];
    for (let b = 0; b < 30; b++) {
      const size = 5 + Math.floor(rand() * 11); // 5..15
      items.push(...bucket(`grammar-${b}`, "grammar", size));
    }
    for (let b = 0; b < 80; b++) {
      const size = rand() < 0.5 ? 1 : 2;
      items.push(...bucket(`other-${b}`, "other", size));
    }
    return items;
  }

  test("the minority category no longer clusters at the back, over 200 trials", () => {
    const TRIALS = 200;
    const EARLY_WINDOW = 53; // the exact window Sam's report and the ticket's own simulation used

    let n = 0;
    let sumGrammarPos = 0;
    let nGrammar = 0;
    let sumOtherPos = 0;
    let nOther = 0;
    let otherInWindow = 0;
    let totalOther = 0;
    let sumFirstOtherPos = 0;
    let maxCollisions = 0;

    for (let trial = 0; trial < TRIALS; trial++) {
      const items = buildComposition(mulberry32(1000 + trial));
      n = items.length;
      const out = spread(items, keyOf, mulberry32(trial * 7919 + 13));

      let collisions = 0;
      for (let i = 1; i < out.length; i++) {
        if (out[i]!.key === out[i - 1]!.key) collisions++;
      }
      maxCollisions = Math.max(maxCollisions, collisions);

      const firstOther = out.findIndex((it) => it.cat === "other");
      sumFirstOtherPos += firstOther;

      out.forEach((it, pos) => {
        if (it.cat === "grammar") {
          sumGrammarPos += pos;
          nGrammar++;
        } else {
          sumOtherPos += pos;
          nOther++;
          totalOther++;
          if (pos < EARLY_WINDOW) otherInWindow++;
        }
      });
    }

    const avgGrammarPos = sumGrammarPos / nGrammar;
    const avgOtherPos = sumOtherPos / nOther;
    const uniformAvgPos = (n - 1) / 2;
    const fractionOtherInWindow = otherInWindow / totalOther;
    const uniformFraction = EARLY_WINDOW / n;
    const avgFirstOtherPos = sumFirstOtherPos / TRIALS;

    // Report the real numbers (not just pass/fail) so a future reader can see
    // exactly how close to uniform the fix lands, the same rigor the ticket's
    // own empirical proof used.
    console.log(`SAK-206 distribution check over ${TRIALS} trials (n=${n} per trial):`);
    console.log(`  avg "grammar" position: ${avgGrammarPos.toFixed(2)} (uniform expectation: ${uniformAvgPos.toFixed(2)})`);
    console.log(`  avg "other" position:   ${avgOtherPos.toFixed(2)} (uniform expectation: ${uniformAvgPos.toFixed(2)})`);
    console.log(`  fraction of "other" items in first ${EARLY_WINDOW} positions: ${fractionOtherInWindow.toFixed(4)} (uniform expectation: ${uniformFraction.toFixed(4)}; old buggy algorithm measured 0.0000 here)`);
    console.log(`  avg position of the FIRST "other" item: ${avgFirstOtherPos.toFixed(2)} (Sam's report: the first "number" question landed around #56)`);
    console.log(`  max adjacent same-key collisions in any trial: ${maxCollisions} (must stay 0 — every trial here is feasible)`);

    // The bug this ticket fixes: NONE of the minority category reached the
    // front. The fix does not need to hit the uniform ideal exactly (a
    // weighted scheduler still gives small buckets their first turn a little
    // later than instantaneous, since they accumulate placement credit
    // slowly) but it must be unambiguously, drastically better than the
    // reported 0% — this asserts real presence in the early window, at a
    // small fraction of the uniform ideal as a floor.
    assert.ok(
      fractionOtherInWindow > uniformFraction * 0.3,
      `"other" items barely reached the first ${EARLY_WINDOW} positions (${fractionOtherInWindow.toFixed(4)} vs uniform ${uniformFraction.toFixed(4)}) — the front-loading bug is still present`,
    );
    // The two categories' average positions must land close to each other
    // (and close to the uniform ideal) rather than the old bug's ~165-position
    // gap between them (grammar ~150, other ~315 out of ~384).
    assert.ok(
      Math.abs(avgGrammarPos - avgOtherPos) < n * 0.05,
      `categories still cluster apart: grammar avg ${avgGrammarPos.toFixed(1)} vs other avg ${avgOtherPos.toFixed(1)} (n=${n})`,
    );
    // Sam's report: the first non-grammar question landed around #56. The fix
    // should pull that forward substantially, not just marginally.
    assert.ok(
      avgFirstOtherPos < 53,
      `first "other" item still averages position ${avgFirstOtherPos.toFixed(1)}, no better than the ~56 Sam originally reported`,
    );
    // Every one of these trials is feasible (largest bucket is at most 15,
    // nowhere near ceil(n/2) ~ 200+), so the local guarantee must hold exactly.
    assert.equal(maxCollisions, 0, "a feasible composition produced an adjacent same-key collision");
  });
});

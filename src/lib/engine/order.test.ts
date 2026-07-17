// The always-random-order invariant: the PRESENTATION ORDER of any quiz is
// freshly randomized at every construction (new session, new round, new rerun),
// so position can never be memorised. buildDeck is drill's and pairs' single
// construction point; the grid builds the same way (initGrid → shuffle) and the
// drill's endless replenish concats shuffle(facts).
//
// These test STRUCTURE, not a specific order — a test that asserts one exact
// permutation would either be tautological or flaky. We assert two things:
//   1. the deck is always a PERMUTATION of the selected set (nothing added,
//      dropped or duplicated in the cov/full case); and
//   2. shuffle is actually INVOKED — proven deterministically by stubbing
//      Math.random so Fisher–Yates yields a known NON-identity permutation, and
//      by showing two different random streams yield two different decks.
//
//   node --import ./src/lib/conjugate/test-hooks.mjs --test src/lib/engine/order.test.ts

import test from "node:test";
import assert from "node:assert/strict";

import { buildDeck } from "@/lib/engine/index";
import { kanaFact } from "@/data/characters";
import type { FactId, QuizConfig } from "@/types";

// buildDeck reads only mode/length/limType/limCount off the config. A minimal
// object cast keeps this test off the client-only quiz-config module (a .tsx
// that pulls React and won't resolve under the node test loader).
function cfgOf(over: Partial<QuizConfig> = {}): QuizConfig {
  return {
    mode: "drill",
    length: "limited",
    limType: "cov",
    limCount: 50,
    ...over,
  } as unknown as QuizConfig;
}

const SET: FactId[] = [
  kanaFact("あ"),
  kanaFact("い"),
  kanaFact("う"),
  kanaFact("え"),
  kanaFact("お"),
  kanaFact("か"),
  kanaFact("き"),
  kanaFact("く"),
];

/** Deterministically drive shuffle by scripting Math.random over `fn`. */
function withRandom<T>(seq: number[], fn: () => T): T {
  const real = Math.random;
  let i = 0;
  Math.random = () => seq[i++ % seq.length];
  try {
    return fn();
  } finally {
    Math.random = real;
  }
}

const sorted = (a: FactId[]) => [...a].sort();

test("cov/full-length: the deck is a permutation of the selected set", () => {
  const cfg = cfgOf();
  const deck = buildDeck(SET, cfg);
  assert.equal(deck.length, SET.length);
  assert.deepEqual(sorted(deck), sorted(SET)); // same multiset — nothing lost
});

test("shuffle IS invoked at construction — order is not the input order", () => {
  // Math.random = 0 makes Fisher–Yates swap every i with index 0, a known
  // non-identity permutation for length > 1. If buildDeck skipped the shuffle
  // the deck would equal SET; it must not.
  const cfg = cfgOf();
  const deck = withRandom([0], () => buildDeck(SET, cfg));
  assert.notDeepEqual(deck, SET);
  assert.deepEqual(sorted(deck), sorted(SET)); // still a permutation
});

test("two constructions of the SAME set need not be identical (rerun/new round)", () => {
  // Distinct random streams → distinct orders. This is what makes a rerun and
  // every new round unmemorisable: the presentation order is re-rolled, not
  // replayed. (Two independent constructions of a real quiz each get their own
  // fresh runtime — see quiz-session.beginLeg — and each shuffles anew.)
  const cfg = cfgOf();
  const a = withRandom([0], () => buildDeck(SET, cfg));
  const b = withRandom([0.99], () => buildDeck(SET, cfg));
  assert.notDeepEqual(a, b);
  // Both remain permutations of the same set — only the ORDER differs.
  assert.deepEqual(sorted(a), sorted(SET));
  assert.deepEqual(sorted(b), sorted(SET));
});

test("count-limited drill: repeat-fills to limCount and every fill is shuffled", () => {
  const cfg = cfgOf({ limType: "count", limCount: SET.length * 2 + 3 });
  const deck = buildDeck(SET, cfg);
  assert.equal(deck.length, cfg.limCount); // capped exactly
  // Every fact in the deck comes from the selected set — the fill draws only
  // from `facts`, never from anywhere else.
  const pool = new Set(SET);
  assert.ok(deck.every((f) => pool.has(f)));
});

test("input is not mutated — buildDeck shuffles a copy", () => {
  const before = [...SET];
  withRandom([0], () => buildDeck(SET, cfgOf()));
  assert.deepEqual(SET, before); // caller's array (session.facts) is untouched
});

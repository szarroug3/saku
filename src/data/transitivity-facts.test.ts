// Run: node --import ./src/lib/conjugate/test-hooks.mjs --test \
//        src/data/transitivity-facts.test.ts
//
// WHAT THESE PIN
// ==============
// The transitivity subject publishes into the SAME fact registry as kana and
// kanji, and the invariants that make it a well-formed subject all type-check
// when broken:
//
//   BOTH SIDES MINTED  every pair yields exactly two facts, one per side, so a
//                      verb is always a real fact — an option, a distractor, a
//                      thing history can grade.
//   REGISTRY RESOLVES  every minted fact is findable through facts.ts by lookup
//                      (entryOf/factInfo), never by parsing its id.
//   PARTNER EXISTS     each side's distractor (its partner) is a real fact, so a
//                      board can always be built.
//   ASKABLE SUBSET     only sides whose distractor is safe are askable; the two
//                      ambitransitive sides are minted but not askable.

import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { VERB_PAIRS } from "./transitivity.ts";
import {
  TRANSITIVITY_FACTS,
  TRANSITIVITY_SUBJECT,
  pairEntry,
  pairForEntry,
  sideFactId,
  transitivitySide,
} from "./transitivity-facts.ts";
import { entryOf, factInfo, factsOf } from "../lib/facts.ts";
import { question } from "../lib/transitivity.ts";

describe("every pair mints two facts, one per side", () => {
  test("count is 2 × pairs", () => {
    assert.equal(TRANSITIVITY_FACTS.length, VERB_PAIRS.length * 2);
  });

  test("each pair's entry holds exactly its two side facts", () => {
    for (const p of VERB_PAIRS) {
      const entry = pairEntry(p);
      const facts = factsOf(entry);
      assert.equal(facts.length, 2, `${entry} should hold two facts`);
      assert.ok(facts.includes(sideFactId(p, "happens")));
      assert.ok(facts.includes(sideFactId(p, "doIt")));
    }
  });

  test("a side fact's glyph is its own verb, its meaning the English cue", () => {
    for (const p of VERB_PAIRS) {
      for (const side of ["happens", "doIt"] as const) {
        const info = factInfo(sideFactId(p, side));
        assert.ok(info, "fact must be in the registry");
        assert.equal(info.subject, TRANSITIVITY_SUBJECT);
        assert.equal(info.glyph, p[side].word);
        assert.equal(info.meaning, p[side].en);
        assert.ok(info.answers.includes(p[side].word));
      }
    }
  });
});

describe("the registry resolves every minted fact by lookup", () => {
  test("entryOf(fact) is the pair entry, and it round-trips to the pair", () => {
    for (const p of VERB_PAIRS) {
      const entry = pairEntry(p);
      assert.equal(entryOf(sideFactId(p, "happens")), entry);
      assert.equal(entryOf(sideFactId(p, "doIt")), entry);
      assert.equal(pairForEntry(entry), p);
    }
  });
});

describe("every side has a real partner and a correct askable flag", () => {
  test("the partner is the other side's fact and it exists", () => {
    for (const p of VERB_PAIRS) {
      const happens = transitivitySide(sideFactId(p, "happens"))!;
      const doIt = transitivitySide(sideFactId(p, "doIt"))!;
      assert.equal(happens.partner, sideFactId(p, "doIt"));
      assert.equal(doIt.partner, sideFactId(p, "happens"));
      assert.ok(factInfo(happens.partner), "partner must be a real fact");
      assert.ok(factInfo(doIt.partner), "partner must be a real fact");
    }
  });

  test("askable matches the question builder's refusal, side for side", () => {
    for (const p of VERB_PAIRS) {
      for (const side of ["happens", "doIt"] as const) {
        const s = transitivitySide(sideFactId(p, side))!;
        assert.equal(s.askable, question(p, side) !== null);
      }
    }
  });

  test("every pair has at least one askable side", () => {
    for (const p of VERB_PAIRS) {
      const any =
        transitivitySide(sideFactId(p, "happens"))!.askable ||
        transitivitySide(sideFactId(p, "doIt"))!.askable;
      assert.ok(any, `${pairEntry(p)} has no askable side`);
    }
  });
});

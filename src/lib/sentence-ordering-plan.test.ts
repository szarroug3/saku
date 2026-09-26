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
  sentenceTierBlock,
} from "./sentence-ordering-plan.ts";
import { SENTENCE_ORDERING_TIERS, type AssemblyTier } from "../data/assembly.ts";
import { sentenceTierMarkerFact } from "./sentence-ordering-progress.ts";
import { patternMeaningFactId } from "../data/grammar/index.ts";
import { applyClaims, emptyHistory } from "./history-ops.ts";
import type { HistoryFile } from "../types/store.ts";

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
  // check below is left to exercise. It wants EVERY one of a tier's patterns
  // since SAK-490; it used to open Simple on は alone.
  test("does not offer Simple with only は taught, and offers it with は, が and を", () => {
    const wa = applyClaims(emptyHistory(), [patternMeaningFactId("wa")], 1);
    assert.equal(nextSentenceOrderingLesson(true, wa), null, "は alone is not enough");
    const waGa = applyClaims(wa, [patternMeaningFactId("ga")], 2);
    assert.equal(nextSentenceOrderingLesson(true, waGa), null, "nor are は and が");
    const all = applyClaims(waGa, [patternMeaningFactId("wo")], 3);
    assert.equal(nextSentenceOrderingLesson(true, all)?.tierId, "simple");
  });

  test("later tiers need every one of their own patterns, not just the earlier tier's", () => {
    let history = applyClaims(
      emptyHistory(),
      [...["wa", "ga", "wo"].map(patternMeaningFactId), sentenceTierMarkerFact("simple")],
      1,
    );
    assert.equal(nextSentenceOrderingLesson(true, history), null);

    // one of Sequential's five used to open it
    history = applyClaims(history, [patternMeaningFactId("te-kara")], 2);
    assert.equal(nextSentenceOrderingLesson(true, history), null, "〜てから alone is not enough");

    const sequential = SENTENCE_ORDERING_TIERS.find((t) => t.id === "sequential")!;
    history = applyClaims(history, sequential.grammarPrereqs.map(patternMeaningFactId), 3);
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

// SAK-430. The unlock rule now keeps its reason, because the Observatory lists
// a tier it cannot start yet and says on the card what opens it. The yes-or-no
// the planner uses is this same function, so the two cannot drift apart.
describe("sentenceTierBlock", () => {
  // SAK-490. Sam, 2026-09-26: "the sentence rule should be blocked until all
  // of its requirements are known." The block names what is still missing.
  test("with は learned and not が or を, Simple waits on が and を", () => {
    const simple = SENTENCE_ORDERING_TIERS[0];
    assert.equal(simple.id, "simple");
    assert.deepEqual(sentenceTierBlock(simple, EMPTY), {
      kind: "grammar",
      patterns: simple.grammarPrereqs,
    });
    const wa = applyClaims(emptyHistory(), [patternMeaningFactId("wa")], 1);
    assert.deepEqual(sentenceTierBlock(simple, wa), { kind: "grammar", patterns: ["ga", "wo"] });
    const all = applyClaims(wa, [patternMeaningFactId("ga"), patternMeaningFactId("wo")], 2);
    assert.equal(sentenceTierBlock(simple, all), null);
  });

  test("with one of Causal's two learned, Causal waits on the other", () => {
    const causal = SENTENCE_ORDERING_TIERS.find((t) => t.id === "causal")!;
    assert.deepEqual([...causal.grammarPrereqs], ["kara-reason", "node"]);
    const kara = applyClaims(emptyHistory(), [patternMeaningFactId("kara-reason")], 1);
    assert.deepEqual(sentenceTierBlock(causal, kara), { kind: "grammar", patterns: ["node"] });
    const both = applyClaims(kara, [patternMeaningFactId("node")], 2);
    assert.equal(sentenceTierBlock(causal, both), null);
  });

  test("every one of the ten types opens on all of its patterns and on nothing less", () => {
    assert.equal(SENTENCE_ORDERING_TIERS.length, 10);
    for (const tier of SENTENCE_ORDERING_TIERS) {
      const all = tier.grammarPrereqs.map(patternMeaningFactId);
      assert.equal(sentenceTierBlock(tier, applyClaims(emptyHistory(), all, 1)), null, `${tier.id} opens on all of them`);
      for (const left of tier.grammarPrereqs) {
        const others = applyClaims(emptyHistory(), all.filter((f) => f !== patternMeaningFactId(left)), 1);
        assert.deepEqual(
          sentenceTierBlock(tier, others),
          { kind: "grammar", patterns: [left] },
          `${tier.id} waits on ${left} when it is the one left`,
        );
      }
    }
  });

  test("says how far short the pool is when the tier has too few sentences", () => {
    // every shipped tier clears its own floor today, so the short-pool half of
    // the rule is exercised on a tier asking for more than the corpus holds
    const simple = SENTENCE_ORDERING_TIERS[0];
    const greedy: AssemblyTier = { ...simple, minReadable: 10_000, grammarPrereqs: [] };
    const block = sentenceTierBlock(greedy, EMPTY);
    assert.equal(block?.kind, "sentences");
    assert.equal(block?.kind === "sentences" && block.need, 10_000);
    assert.ok(block?.kind === "sentences" && block.have > 0 && block.have < 10_000);
  });
});

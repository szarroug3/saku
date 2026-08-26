// SAK-203: buildDeck's two grammar-specific additions, proven against REAL
// recipes and REAL production fact ids — not a stand-in. host-group.test.ts
// and vehicle-spread.test.ts cover the two pieces (the lookup, the swap
// algorithm) in isolation; this file is the one that proves the wiring in
// buildDeck (engine/index.ts) actually fixes both of Sam's reported examples:
//
//   1. "how do you say after 行く" / "please 行く" / "must not 行く" back to
//      back — three DIFFERENT recipes' @iku fact landing adjacent, which
//      spread(deck, entryOf) cannot see because entryOf is per-pattern.
//   2. a length-capped session showing "after 行く" / "after する" /
//      "after 遊ぶ" and nothing else for te-kara — a naive slice keeping a
//      handful of te-kara's 13 verb production facts and dropping the rest.
//
// Also proves the FIX IS A NO-OP for non-grammar decks — the standing
// constraint that this stays scoped to grammar production and does not touch
// how kana/kanji/word facts get ordered.
//
// Run:
//   node --experimental-strip-types --import ./src/lib/conjugate/test-hooks.mjs \
//        --test src/lib/engine/build-deck-grammar.test.ts

import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { buildDeck } from "@/lib/engine/index.ts";
import {
  classProductionFactId,
  specialVerbProductionFactId,
} from "@/data/grammar";
import { grammarVehicleBucketOf } from "@/lib/grammar/host-group.ts";
import { kanaFact } from "@/data/characters.ts";
import type { FactId, QuizConfig } from "@/types";

// buildDeck reads only mode/length/limType/limCount off the config — the same
// minimal cast engine/order.test.ts already uses, to stay off the client-only
// quiz-config module.
function cfgOf(over: Partial<QuizConfig> = {}): QuizConfig {
  return {
    mode: "drill",
    length: "limited",
    limType: "cov",
    limCount: 50,
    ...over,
  } as unknown as QuizConfig;
}

/** Deterministically drive shuffle by scripting Math.random over `fn` — same
 * helper as engine/order.test.ts. */
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

const CLASSES = [
  "v5u", "v5t", "v5r", "v5m", "v5b", "v5n", "v5k", "v5g", "v5s", "v1",
] as const;

describe("buildDeck spaces same-vehicle grammar cards across DIFFERENT patterns", () => {
  test("SAK-203 example 1: three recipes' @iku fact never land adjacent", () => {
    const iku = ["te-kara", "te-request", "te-prohibition"].map((r) =>
      specialVerbProductionFactId(r, "iku"),
    );
    // Filler that would otherwise be indistinguishable from the iku facts on
    // the ENTRY axis (every id below is a different recipe, so spread(deck,
    // entryOf) alone has no reason to keep the iku trio apart at all).
    const filler = ["te-mo", "te-shimau", "te-oku", "te-miru"].map((r) =>
      specialVerbProductionFactId(r, "suru"),
    );
    const facts: FactId[] = [...iku, ...filler];
    assert.ok(iku.every((f) => grammarVehicleBucketOf(f) === grammarVehicleBucketOf(iku[0])));

    // Run several independent shuffles (not just one lucky draw) and confirm
    // the fix holds across all of them.
    for (const seed of [0, 0.25, 0.5, 0.75, 0.99]) {
      const deck = withRandom([seed], () => buildDeck(facts, cfgOf()));
      let adjacentIku = 0;
      for (let i = 1; i < deck.length; i++) {
        if (iku.includes(deck[i - 1]) && iku.includes(deck[i])) adjacentIku++;
      }
      assert.equal(adjacentIku, 0, `seed ${seed}: two 行く cards ended up adjacent`);
      // Still a permutation — nothing added, dropped, or duplicated.
      assert.deepEqual([...deck].sort(), [...facts].sort());
    }
  });
});

describe("buildDeck keeps full ENDING coverage under a tight length cap", () => {
  // 13 unique facts sliced to N are trivially N unique facts regardless of any
  // fix — a slice cannot duplicate elements. The REAL failure mode (and the
  // one `pairsKept` exists to prevent, see budget.ts's doc comment) is a
  // MIXED pool: te-kara's several class/irregular facts sitting among plenty
  // of UNRELATED filler that a naive cut is just as likely to keep instead —
  // "after 行く", "after する" and nothing else for the whole session, with
  // every other te-kara class silently bumped out in favour of kana filler
  // that happened to shuffle earlier. That is SAK-203 example 2.
  const teKaraFacts = [
    classProductionFactId("te-kara", "v5u"),
    classProductionFactId("te-kara", "v5m"),
    classProductionFactId("te-kara", "v1"),
    specialVerbProductionFactId("te-kara", "iku"),
    specialVerbProductionFactId("te-kara", "suru"),
  ]; // 5 required slots once 2+ are present — see grammarVehicleSlotOf.
  const HIRAGANA = [..."あいうえおかきくけこさしすせそたちつてとなにぬねの"];
  const filler: FactId[] = HIRAGANA.map((c) => kanaFact(c)); // 25 unrelated facts

  test("SAK-203 example 2: te-kara's due classes/irregulars all survive a cap with room for them", () => {
    const facts = [...teKaraFacts, ...filler]; // 30 total
    const cfg = cfgOf({ limType: "count", limCount: 7 }); // room for all 5 + 2 filler

    for (const seed of [0.05, 0.3, 0.55, 0.8]) {
      const deck = withRandom([seed], () => buildDeck(facts, cfg));
      assert.equal(deck.length, 7, "still honours the requested count");
      const missing = teKaraFacts.filter((f) => !deck.includes(f));
      assert.deepEqual(missing, [], `seed ${seed}: dropped te-kara slot(s) ${missing.join(", ")}`);
      // Distinct endings/irregulars, not five copies of one slot re-selected.
      const slots = new Set(deck.filter((f) => teKaraFacts.includes(f)).map(grammarVehicleBucketOf));
      assert.equal(slots.size, 5);
    }
  });

  test("without the fix (grammarVehicleSlotOf absent) the SAME pool really can lose te-kara slots", () => {
    // Confirms the test above is not vacuous — pairsKept with NO grouping
    // function is the old plain-slice behaviour, and CAN drop several of the
    // five required facts for a fixed shuffle.
    const facts = [...teKaraFacts, ...filler];
    let sawALoss = false;
    for (const seed of [0.05, 0.3, 0.55, 0.8, 0.15, 0.65, 0.9]) {
      const naive = withRandom([seed], () => {
        // Same shuffle buildDeck itself performs, minus the coverage cut.
        const shuffled = facts.slice();
        for (let i = shuffled.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        return shuffled.slice(0, 7);
      });
      if (teKaraFacts.some((f) => !naive.includes(f))) sawALoss = true;
    }
    assert.ok(sawALoss, "test setup: the naive cut must actually lose coverage sometimes");
  });

  test("a cap wide enough to hold every one of te-kara's 13 verb slots loses none of them", () => {
    const classFacts = CLASSES.map((c) => classProductionFactId("te-kara", c));
    const irregularFacts = ["iku", "suru", "kuru"].map((q) =>
      specialVerbProductionFactId("te-kara", q),
    );
    const facts = [...classFacts, ...irregularFacts, ...filler];
    assert.equal(classFacts.length + irregularFacts.length, 13);
    const cfg = cfgOf({ limType: "count", limCount: 13 });
    const deck = withRandom([0.5], () => buildDeck(facts, cfg));
    assert.equal(deck.length, 13);
    const kept = deck.filter((f) => [...classFacts, ...irregularFacts].includes(f));
    assert.equal(kept.length, 13, "all 13 te-kara slots survive when the cap can hold them");
  });
});

describe("both SAK-203 passes are a complete no-op for non-grammar decks", () => {
  test("a plain kana deck is unaffected by the coverage cut or the vehicle spread", () => {
    const kanaSet: FactId[] = [
      kanaFact("あ"), kanaFact("い"), kanaFact("う"), kanaFact("え"), kanaFact("お"),
      kanaFact("か"), kanaFact("き"), kanaFact("く"), kanaFact("け"), kanaFact("こ"),
    ];
    // grammarVehicleBucketOf must see nothing to group here — the contract
    // both new buildDeck passes rely on to be a no-op outside grammar.
    assert.ok(kanaSet.every((f) => grammarVehicleBucketOf(f) === null));

    const cfg = cfgOf({ limType: "count", limCount: 4 });
    const deck = withRandom([0], () => buildDeck(kanaSet, cfg));
    assert.equal(deck.length, 4);
    const pool = new Set(kanaSet);
    assert.ok(deck.every((f) => pool.has(f)), "still drawn only from the selected set");
  });
});

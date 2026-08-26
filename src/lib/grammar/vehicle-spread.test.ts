// Run:
//   node --experimental-strip-types --import ./src/lib/conjugate/test-hooks.mjs \
//        --test src/lib/grammar/vehicle-spread.test.ts
//
// Synthetic-key tests: `spreadGrammarVehicles` is a pure array transform, so
// these prove the SWAP LOGIC itself (fix a vehicle collision, never reopen an
// entry collision, degrade gracefully when no fix exists) without needing a
// single real grammar fact. host-group.test.ts covers the REAL key functions
// (`grammarVehicleBucketOf` reading off real fact ids); engine's
// build-deck-grammar.test.ts covers the two wired together inside buildDeck.

import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { spreadGrammarVehicles } from "./vehicle-spread.ts";
import type { FactId } from "@/types";

/** A tiny synthetic fact: "<entry>#<vehicle>#<n>" — n disambiguates otherwise
 * -identical cards so array equality checks stay honest. */
function card(entry: string, vehicle: string | null, n = 0): FactId {
  return `${entry}#${vehicle ?? "-"}#${n}` as FactId;
}
const entryOf = (f: FactId): string => f.split("#")[0]!;
const vehicleOf = (f: FactId): string | null => {
  const v = f.split("#")[1]!;
  return v === "-" ? null : v;
};

describe("spreadGrammarVehicles — fixes what entry-spread cannot see", () => {
  test("two different-entry cards that share a vehicle get separated", () => {
    // te-kara's @iku next to te-request's @iku — different entries (so
    // spread(deck, entryOf) has no reason to touch them), same vehicle.
    const a = card("te-kara", "行く");
    const b = card("te-request", "行く");
    const filler = card("te-prohibition", "する");
    const deck = [a, b, filler];
    const out = spreadGrammarVehicles(deck, vehicleOf, entryOf);
    const ia = out.indexOf(a);
    const ib = out.indexOf(b);
    assert.notEqual(Math.abs(ia - ib), 1, "the two 行く cards must no longer be adjacent");
    // Nothing added, dropped, or duplicated.
    assert.deepEqual([...out].sort(), [...deck].sort());
  });

  test("cards with no vehicle collision are left exactly where they were", () => {
    const deck = [
      card("a", "1"),
      card("b", "2"),
      card("c", "3"),
      card("d", null), // a non-grammar card, vehicle key null
    ];
    const out = spreadGrammarVehicles(deck, vehicleOf, entryOf);
    assert.deepEqual(out, deck);
  });

  test("a fix never reopens an entry collision spread() already closed", () => {
    // Two te-kara cards (different vehicle, same entry) already sit apart by
    // one slot — exactly what spread(deck, entryOf) guarantees. Sandwiched
    // between them is a same-vehicle collision the fix must resolve WITHOUT
    // landing a te-kara card next to the other te-kara card.
    const teKaraA = card("te-kara", "書く");
    const teKaraB = card("te-kara", "話す");
    const iku1 = card("te-request", "行く");
    const iku2 = card("te-prohibition", "行く");
    const filler = card("te-mo", "見る");
    // teKaraA, iku1, iku2 (COLLISION), teKaraB, filler — moving iku2 next to
    // teKaraB would create a NEW te-kara/te-kara-adjacent... no: teKaraB is
    // te-kara, iku2 is te-request, so that boundary is fine; the only trap is
    // iku2 landing where it would sit next to a te-kara card is a non-issue
    // here since entries differ. The real trap: swapping iku2 all the way to
    // the end, past filler, would put it next to nothing dangerous — so
    // instead verify the MINIMAL, in-place fix: iku1/iku2 must stop touching,
    // and every entry-adjacency that held before must still hold or be
    // replaced by another SAFE one, never a matching pair.
    const deck = [teKaraA, iku1, iku2, teKaraB, filler];
    const out = spreadGrammarVehicles(deck, vehicleOf, entryOf);
    for (let i = 1; i < out.length; i++) {
      const vPrev = vehicleOf(out[i - 1]);
      const vCur = vehicleOf(out[i]);
      if (vPrev !== null && vCur !== null) {
        assert.notEqual(vPrev, vCur, `vehicle collision remains at ${i}`);
      }
      assert.notEqual(
        entryOf(out[i - 1]),
        entryOf(out[i]),
        `a NEW entry collision was introduced at ${i}`,
      );
    }
    assert.deepEqual([...out].sort(), [...deck].sort());
  });

  test("graceful degradation: an unfixable collision is left as-is, nothing lost", () => {
    // Only two cards exist and they share both axes' only option — there is
    // no candidate to swap with at all.
    const a = card("te-kara", "行く", 0);
    const b = card("te-kara", "行く", 1);
    const out = spreadGrammarVehicles([a, b], vehicleOf, entryOf);
    assert.deepEqual([...out].sort(), [a, b].sort());
  });

  test("input is not mutated", () => {
    const deck = [card("te-kara", "行く"), card("te-request", "行く"), card("te-mo", "見る")];
    const before = [...deck];
    spreadGrammarVehicles(deck, vehicleOf, entryOf);
    assert.deepEqual(deck, before);
  });

  test("a longer run of the same vehicle across many entries still ends up spread, not left clustered", () => {
    // Five different recipes' @iku fact, interleaved with five unrelated
    // filler cards spread(deck, entryOf) would already have placed between
    // pattern-identical neighbours — this is the shape a real due-for-review
    // pull produces once several て-form recipes are due at once.
    const ikus = Array.from({ length: 5 }, (_, i) => card(`recipe${i}`, "行く"));
    const fillers = Array.from({ length: 5 }, (_, i) => card(`filler${i}`, `word${i}`));
    // Worst case for THIS pass: every 行く card already sits next to another
    // 行く card (as if entry-spread had no reason to separate them, since
    // every recipe is a distinct entry).
    const deck = [...ikus, ...fillers];
    const out = spreadGrammarVehicles(deck, vehicleOf, entryOf);
    let adjacentIkuPairs = 0;
    for (let i = 1; i < out.length; i++) {
      if (vehicleOf(out[i - 1]) === "行く" && vehicleOf(out[i]) === "行く") adjacentIkuPairs++;
    }
    // 10 cards, 5 of one vehicle: perfectly feasible to reach zero adjacent
    // 行く pairs (the same feasibility bound spread() itself documents).
    assert.equal(adjacentIkuPairs, 0);
    assert.deepEqual([...out].sort(), [...deck].sort());
  });
});

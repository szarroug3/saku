// SAK-203: a second, LOCAL spacing pass over a built deck's grammar
// production facts, layered on top of engine/spread.ts's `spread(deck,
// entryOf)`.
//
// WHY spread() ALONE MISSES THIS
// ================================
// spread(deck, entryOf) keeps two cards of the SAME PATTERN apart — te-kara's
// v5k fact and its v5g fact never land next to each other, because entryOf
// keys them both to te-kara's one Library entry. But two DIFFERENT patterns
// can independently pin the SAME vehicle word: every て-form recipe 行く is
// irregular for mints its own @iku production fact (mintSpecialWordFacts,
// data/grammar/index.ts), and a singleton-pool regular class (v5k → 書く and
// only 書く in vehicles.ts's VERB_VEHICLES) resolves the same way for every
// recipe that scores it. entryOf is the PATTERN's identity, not the WORD's,
// so spread() has no way to see that "how do you say after 行く" and "how do
// you say please 行く" are, from the learner's seat, the same word twice in a
// row — this is SAK-203's reported example 1, and it is invisible to a
// mechanism that only ever compares recipe identity.
//
// WHY A SEPARATE PASS, AND NOT A SECOND KEY INSIDE spread()
// =============================================================
// spread()'s bucket algorithm optimises ONE axis at a time; asking it to keep
// two DIFFERENT partitions of the same deck both unclustered at once is a
// harder problem (a card can be the odd one out on axis A while belonging to
// the dominant bucket on axis B) than its existing greedy has any way to
// balance, and changing that shared, zero-import leaf risks every OTHER
// subject's deck order along with it — out of bounds for a fix scoped to
// grammar production (see this file's own doc comment on why it stays out of
// spread.ts). So this runs AFTER spread(), as a bounded LOCAL repair: it never
// reshuffles the deck spread() already produced, it only swaps a card forward
// past a same-vehicle collision, and only when doing so does not reopen the
// same-ENTRY collision spread() just closed.
//
// BEST EFFORT, NOT A GUARANTEE — the same honesty spread()'s own "graceful
// degradation" note states. A deck that is overwhelmingly one recipe's
// irregular fact cannot avoid repeating that word no matter how it is
// ordered; this fixes what is fixable and leaves the rest exactly where
// spread() put it.

import type { FactId } from "@/types";

/**
 * Nudge grammar-production cards that would draw the SAME vehicle word apart,
 * without undoing the entry-level spacing `spread(deck, entryOf)` already
 * produced.
 *
 * `vehicleKeyOf` should be `grammarVehicleBucketOf` (host-group.ts) in
 * production: null for anything that is not a grammar production fact, which
 * makes this a complete no-op for every other subject's cards (they can never
 * collide on an axis they don't have a key on). `entryKeyOf` should be the
 * SAME `entryOf` the prior `spread()` call used, so "would this swap reopen a
 * pattern collision" is asked in the one vocabulary both passes share.
 *
 * ALGORITHM: a single left-to-right scan. Whenever position i collides with
 * i-1 on the vehicle axis, look forward for the nearest later card whose swap
 * into position i clears that collision without opening a NEW collision
 * (either axis) at either position the swap touches — checked by re-reading
 * the live array after a provisional swap, not by hand-deriving neighbour
 * indices, so the i+1-equals-j adjacency case falls out for free instead of
 * needing its own branch. No candidate found means the collision is left in
 * place: exactly `spread()`'s own infeasible-case honesty, not a bug in this
 * pass.
 */
export function spreadGrammarVehicles(
  deck: readonly FactId[],
  vehicleKeyOf: (fact: FactId) => string | null,
  entryKeyOf: (fact: FactId) => string,
): FactId[] {
  const out = deck.slice();

  // Would out[k], as the array stands RIGHT NOW, collide with either neighbour
  // on either axis? Used to validate a candidate destination before keeping a
  // swap — read live so the i+1 === j case (swapping with your immediate
  // neighbour) is handled by the same check as any other distance.
  const collides = (k: number): boolean => {
    const vk = vehicleKeyOf(out[k]);
    const ek = entryKeyOf(out[k]);
    for (const n of [k - 1, k + 1]) {
      if (n < 0 || n >= out.length) continue;
      if (vk !== null && vehicleKeyOf(out[n]) === vk) return true;
      if (entryKeyOf(out[n]) === ek) return true;
    }
    return false;
  };

  for (let i = 1; i < out.length; i++) {
    const vk = vehicleKeyOf(out[i]);
    if (vk === null || vehicleKeyOf(out[i - 1]) !== vk) continue; // nothing to fix

    for (let j = i + 1; j < out.length; j++) {
      [out[i], out[j]] = [out[j], out[i]];
      if (!collides(i) && !collides(j)) break; // keep the swap
      [out[i], out[j]] = [out[j], out[i]]; // undo, try the next candidate
    }
  }
  return out;
}

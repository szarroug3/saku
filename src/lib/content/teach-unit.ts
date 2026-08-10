// TEACH UNIT — the contract for "teach meanings, not words".
//
// Today a ContentItem carries a flat `facts: Fact[]`, and a character double-
// counts: 三 has kanji-"three" AND word-"three"; 人 has radical-"man", kanji-
// "person", word-"person". A TEACH UNIT is the deduped thing a learner actually
// studies: ONE meaning (by MeaningId, so "man"/"person" or "speak"/"talk" collapse
// via the registry) paired with the reading taught for it, split into what is
// drilled vs what is reference-only (CEJC-rare).
//
// This file is the TYPE contract the architecture track implements against; the
// functions below are specified here and implemented once the meaning-registry
// contract (meaning.ts) is agreed. It needs NO new data beyond:
//   • meaning-registry.json  (meaning.ts)          — dedup key
//   • the existing CEJC taught/reference split (vocab.ts teachingSenses/
//     referenceReadings)                            — the `taught` flag
//
// HISTORY SAFETY: a TeachUnit GROUPS existing facts; it never re-keys them. The
// `facts` array is the underlying fact ids (history stays on those). When several
// facts share a meaning, the drill scores ONE representative; the rest are shown,
// aliased, never a second graded card — so no learner record moves.

import type { FactId } from "@/types";
import type { MeaningId } from "./meaning";
import type { ContentItem } from "./item";

/** One deduped thing a learner studies about an item. */
export interface TeachUnit {
  /** Canonical meaning identity — the dedup key. Two source glosses that the
   * registry judged synonymous produce ONE unit. */
  readonly meaning: MeaningId;
  /** The gloss to show for this meaning (the registry's canonical label). */
  readonly label: string;
  /** The reading taught for this meaning, or null for a meaning with no scored
   * reading (a kanji sense whose readings ride its attesting words). */
  readonly reading: string | null;
  /** True = drilled; false = reference tier (a CEJC-rare meaning/reading shown in
   * the Library but never scored). */
  readonly taught: boolean;
  /** The underlying facts this unit groups. History stays on these ids; the drill
   * scores one representative. Never empty. */
  readonly facts: readonly FactId[];
}

/**
 * CONTRACT (to be implemented by the architecture track):
 *
 *   teachUnitsOf(item): readonly TeachUnit[]
 *     Group item.facts by canonicalMeaningId(gloss-of-fact) for definition facts,
 *     attach each meaning's taught reading, and mark taught vs reference from the
 *     CEJC split. Source precedence: a word glyph's meanings come from its word
 *     definitions; the kanji-meaning fact is folded in only when no word covers
 *     it. Radical meaning stays its own unit unless the registry merges it.
 *
 *   itemCost(item): number   (replaces cost.ts)
 *     = count of TAUGHT units = |unique taught meanings| + |unique taught readings|.
 *     So 三 costs 1 meaning + 1 reading (not 3 facts); 人 costs person + man +
 *     any CEJC-frequent extra senses, deduped — the count Sam asked for.
 */
export type TeachUnitsOf = (item: ContentItem) => readonly TeachUnit[];

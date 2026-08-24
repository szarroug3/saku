// MEANING IDENTITY — the one place the app answers "are these the same meaning?"
//
// KEYED BY FACT, NOT GLOSS — because meaning is CONTEXTUAL. "man" means "person"
// on 人 but stays "man" (male) on 男; a global gloss→id map would wrongly merge
// them. So the registry maps a MEANING FACT to a canonical MeaningId, per glyph.
// This also lets us REUSE the CEJC work's `definitionId`: a word meaning fact's
// MeaningId is simply its `definitionId` (senses already grouped there), and the
// registry only has to place the NON-word meaning facts (kanji, radical) onto the
// right definitionId.
//
// THE CONTRACT (this file is the seam between the data track and the content
// model; keeping ALL synonymy logic on one side is what stops the two drifting):
//
//   • The DATA track owns every judgment. Its ingest emits
//     `src/data/generated/meaning-registry.json` — `Record<FactId, MeaningId>`
//     over meaning (definition) facts:
//        - a WORD meaning fact  → its `definitionId` (reuse; trivial)
//        - a KANJI / RADICAL meaning fact → the `definitionId` of the same
//          glyph's word sense it is synonymous with (人 radical "man" → 人's
//          "person" definitionId), by EXACT gloss match first, else LLM-judge,
//          else a minted id of its own. Human-reviewed.
//     See docs/architecture-refactor.md §"Meaning model".
//
//   • The CONTENT model only READS, via `canonicalMeaningId(factId, gloss)`. It
//     never normalizes or compares gloss strings to decide synonymy — that lives
//     entirely in the registry. The `gloss` arg is only a SAFE FALLBACK: within
//     one item (one glyph) identical glosses are the same thing, so exact-gloss
//     dedup works before the registry lands and can't over-merge across glyphs
//     (each item dedupes its own facts).
//
// TWO HARD CONSTRAINTS on the data track's ids:
//   1. STABLE across regenerations (reusing `definitionId` gives this for free).
//   2. NON-DESTRUCTIVE — MeaningId does NOT re-key facts. History stays on fact
//      ids; MeaningId is a DERIVED grouping for cost + picking one representative
//      fact per meaning to drill. Same care CEJC took with legacyUnqualifiedReading.

import REGISTRY from "@/data/generated/meaning-registry.json" with { type: "json" };
import type { FactId } from "@/types";

const ENTRY_BRAND: unique symbol = Symbol("MeaningId");

/** A canonical meaning identity (a `definitionId`, or a minted id). Two meaning
 * facts share one iff the data track judged them the same meaning. Opaque. */
export type MeaningId = string & { readonly [ENTRY_BRAND]: true };

const MAP = REGISTRY as Record<string, string>;

/**
 * The canonical MeaningId of a meaning fact. Pure lookup into the reviewed
 * registry; NO synonymy logic here. Falls back to the fact's own `gloss` when the
 * registry has no entry — safe because callers dedupe WITHIN one item, where an
 * identical gloss is by definition the same meaning. So the app degrades to
 * exact-match dedup (never a wrong cross-glyph merge) until the registry lands.
 */
export function canonicalMeaningId(factId: FactId, gloss: string): MeaningId {
  return (MAP[factId] ?? gloss) as MeaningId;
}

// itemCost — how much learning an item is, counted as UNIQUE meanings + UNIQUE
// readings, not raw facts.
//
// A cohesive character double-counts at the fact level: 三 has kanji-"three" AND
// word-"three"; 人 has radical-"man", kanji-"person", word-"person". Those are not
// three things to learn. Cost dedupes:
//   - a DEFINITION fact contributes its meaning, keyed by canonicalMeaningId — so
//     "person"/"person" collapse now (exact match), and "man"/"person" collapse
//     once the reviewed meaning-registry says so (meaning.ts);
//   - a READING (romaji) fact contributes its reading string — kana, so exact
//     match is enough; いち attested twice counts once.
// One per unique meaning, one per unique reading. This is the owner's model
// ("count the distinct things to attach") with the double-count removed.
//
// PENDING: the taught-vs-reference split. The contract (teach-unit.ts) is that
// cost counts TAUGHT units only; until teachUnitsOf lands with the CEJC split,
// this counts every meaning/reading present. Deduping is the first, safe half.

import { factInfo } from "@/lib/facts";
import { canonicalMeaningId } from "./meaning";
import type { ContentItem } from "./item";

/**
 * The learning cost of an item: unique meanings + unique readings. `buildGlyphItem`
 * refuses a fact-less entry, so every real item costs at least 1 — the scheduler's
 * budget always advances.
 */
export function itemCost(item: ContentItem): number {
  const meanings = new Set<string>();
  const readings = new Set<string>();
  for (const f of item.facts) {
    const info = factInfo(f.id);
    if (!info) continue;
    if (f.kind === "definition") {
      if (info.meaning) meanings.add(canonicalMeaningId(info.meaning));
    } else {
      // romaji: the reading itself (answers[0]); fall back to the gloss if absent.
      const reading = info.answers[0] ?? info.meaning;
      if (reading) readings.add(reading);
    }
  }
  return meanings.size + readings.size;
}

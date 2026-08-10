// itemCost — how much learning an item is, counted as the number of distinct
// MEANINGS taught. NOT the readings.
//
// A fact is a pronunciation→meaning association: "read さん, means three" is one
// thing to ingrain. A pronunciation that carries two meanings is two facts (two
// associations); the reading itself is shared context, not a separate +1. So cost
// counts distinct meanings only.
//
// Meanings dedupe by canonicalMeaningId: 三's kanji-three and word-three are one
// meaning (exact match); 人's "man"/"person" collapse once the meaning-registry
// says so. So 三 costs 1, 耳 costs 1, and 人 costs its distinct senses.
//
// PENDING: the taught-vs-reference split (teach-unit.ts) and per-pronunciation
// scoping — the scheduler will teach one pronunciation per page, so a page's cost
// is that pronunciation's meanings. This counts every taught meaning on the item;
// the reference tier is already excluded upstream (readingUnits → teachingSenses).

import { factInfo } from "@/lib/facts";
import { canonicalMeaningId } from "./meaning";
import type { ContentItem } from "./item";

/**
 * The learning cost of an item: the number of distinct MEANINGS it teaches
 * (deduped by canonicalMeaningId). Readings are not counted — a reading is shared
 * across the meanings read that way. `buildGlyphItem` refuses a fact-less entry,
 * so every real item costs at least 1.
 */
export function itemCost(item: ContentItem): number {
  const meanings = new Set<string>();
  for (const f of item.facts) {
    if (f.kind !== "definition") continue;
    const info = factInfo(f.id);
    if (info?.meaning) meanings.add(canonicalMeaningId(f.id, info.meaning));
  }
  return meanings.size;
}

// KANA units — a kana teaches its glyph → SOUND (え → "e"). One unit per kana; no
// meaning (a kana is not a word), so it is a pronunciation unit with the sound as
// its reading and an empty meanings list.

import { KANA_FACTS } from "@/data/characters";
import { factInfo } from "@/lib/facts";
import { buildItem } from "./build-item";
import type { ContentItem } from "./item";
import type { PronunciationUnit } from "./teach-unit";

/** Every kana as a ContentItem — the distinct entries of KANA_FACTS, each via
 * buildItem (their facts are in the registry). */
export function kanaItems(): ContentItem[] {
  const seen = new Set<string>();
  const items: ContentItem[] = [];
  for (const fact of KANA_FACTS) {
    if (seen.has(fact.entry)) continue;
    seen.add(fact.entry);
    const item = buildItem(fact.entry, "kana");
    if (item) items.push(item);
  }
  return items;
}

/** The teaching unit of a kana: its glyph read as its sound. */
export function kanaUnitsOf(item: ContentItem): PronunciationUnit[] {
  const first = item.facts[0];
  const sound = first ? (factInfo(first.id)?.answers[0] ?? null) : null;
  return [
    {
      kind: "pronunciation",
      item,
      glyph: item.glyph,
      reading: sound, // the kana sound ("e")
      meanings: [], // a kana carries no meaning
      facts: item.facts.map((f) => f.id),
      cost: 1,
    },
  ];
}

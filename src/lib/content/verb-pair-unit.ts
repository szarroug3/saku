// TRANSITIVITY track — the ContentItems and VerbPairUnits of the verb pairs.
//
// A transitivity pair (src/data/transitivity-facts.ts) is one entry carrying two
// facts, one per side (happens = intransitive, doIt = transitive). `buildItem`
// turns the entry into a valid ContentItem; this file enumerates the distinct
// pair entries and reads the pair's two members back off the data for the unit.

import { buildItem } from "./build-item.ts";
import { TRANSITIVITY_FACTS, pairForEntry } from "@/data/transitivity-facts";
import type { ContentItem } from "./item.ts";
import type { VerbPairUnit } from "./teach-unit.ts";

/** The distinct transitivity pair entries, each as a ContentItem via `buildItem`.
 * One item per pair (its facts are the two sides). Undefined builds are skipped. */
export function transitivityItems(): ContentItem[] {
  const seen = new Set<string>();
  const items: ContentItem[] = [];
  for (const f of TRANSITIVITY_FACTS) {
    if (seen.has(f.entry as string)) continue;
    seen.add(f.entry as string);
    const item = buildItem(f.entry, "transitivity");
    if (item) items.push(item);
  }
  return items;
}

/**
 * The VerbPairUnit of a transitivity item — one unit per item. `intransitive`
 * and `transitive` come from the pair data itself (`pairForEntry`): the
 * intransitive is the `happens` member (開く), the transitive the `doIt` member
 * (開ける) — the same order the entry key encodes (`transitivity:開く/開ける`,
 * intransitive first). Falls back to splitting that key on "/" if the pair
 * lookup misses (item.glyph alone is only the intransitive side).
 */
export function verbPairUnitsOf(item: ContentItem): VerbPairUnit[] {
  const pair = pairForEntry(item.entry);
  let intransitive: string;
  let transitive: string;
  if (pair) {
    intransitive = pair.happens.word;
    transitive = pair.doIt.word;
  } else {
    // The entry key is `transitivity:開く/開ける` — the pair half after the
    // subject prefix splits intransitive-first, matching the data order above.
    const key = String(item.entry).split(":").slice(1).join(":");
    [intransitive = "", transitive = ""] = key.split("/");
  }
  return [
    {
      kind: "verb-pair" as const,
      item,
      intransitive,
      transitive,
      facts: item.facts.map((f) => f.id),
      cost: 2, // both verbs are learned — the intransitive and the transitive
    },
  ];
}

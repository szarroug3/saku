// GRAMMAR track — the ContentItems and GrammarProductionUnits of the patterns.
//
// A grammar pattern (src/data/grammar/index.ts) is one library entry carrying a
// MEANING fact (the gloss) plus its production facts (one per conjugation class /
// host). `buildItem` turns the entry into a valid ContentItem; this file
// enumerates the distinct pattern entries and reads the meaning-fact gloss back
// off each item for the unit's `summary`.

import { buildItem } from "./build-item.ts";
import { factInfo } from "@/lib/facts";
import { GRAMMAR_FACTS } from "@/data/grammar";
import type { ContentItem } from "./item.ts";
import type { GrammarProductionUnit } from "./teach-unit.ts";

/** The distinct grammar pattern entries, each as a ContentItem via `buildItem`.
 * Several recipes may share one library entry; each distinct entry is one item.
 * Undefined builds are skipped. */
export function grammarItems(): ContentItem[] {
  const seen = new Set<string>();
  const items: ContentItem[] = [];
  for (const f of GRAMMAR_FACTS) {
    if (seen.has(f.entry as string)) continue;
    seen.add(f.entry as string);
    const item = buildItem(f.entry, "grammar");
    if (item) items.push(item);
  }
  return items;
}

/**
 * The GrammarProductionUnit of a grammar item — one unit per item. `pattern` is
 * the item's glyph (the pattern label, 〜たい); `summary` is the gloss of the
 * item's MEANING fact — the "definition" fact carries the English gloss as its
 * `meaning`; `cost` is the number of distinct meaning glosses the entry teaches
 * (a pattern with two senses costs 2), never below 1.
 */
export function grammarUnitsOf(item: ContentItem): GrammarProductionUnit[] {
  const glosses = item.facts
    .filter((f) => f.kind === "definition")
    .map((f) => factInfo(f.id)?.meaning)
    .filter((m): m is string => m != null);
  const summary = glosses[0] ?? "";
  const cost = Math.max(1, new Set(glosses).size);
  return [
    {
      kind: "grammar-production" as const,
      item,
      pattern: item.glyph,
      summary,
      facts: item.facts.map((f) => f.id),
      cost,
    },
  ];
}

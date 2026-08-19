// GRAMMAR track — the ContentItems and GrammarProductionUnits of the patterns.
//
// A grammar pattern (src/data/grammar/index.ts) is one library entry carrying a
// MEANING fact (the gloss) plus its production facts (one per conjugation class /
// host). `buildItem` turns the entry into a valid ContentItem; this file
// enumerates the distinct pattern entries and reads the meaning-fact gloss back
// off each item for the unit's `summary`.
//
// ORDERED BY CURRICULUM_LESSONS, NOT BY GRAMMAR_FACTS' OWN ORDER
// ================================================================
// GRAMMAR_FACTS is built by walking RECIPES in its raw, AUTHORED-TABLE order
// (see buildGrammarFacts in data/grammar/index.ts) — the order patterns are
// grouped by function in recipes.ts, not the order the track actually teaches
// them. The real teaching order — foundational forms first (〜な, て/で, 〜てい
// る), then every other pattern N5-before-N4-before-N3 — lives in
// CURRICULUM_LESSONS (data/grammar/lessons.ts), which is what lesson-steps.ts's
// grammar walk (`grammarLessonsForFacts`) actually pages through at runtime.
// This track's units feed BOTH the scheduler (which patterns bundle into one
// sitting) and the /learn tile preview (`next-lesson-preview.tsx`'s
// `lessonItems`, which reads first-appearance order off these units) — so
// walking GRAMMAR_FACTS' raw order here made the tile row disagree with actual
// delivery order (SAK-41): a tile could show 〜てください before 〜て even though
// て/で-form (leadRank 1) is taught well ahead of 〜てください (no lead rank, so
// N5 default). Walking CURRICULUM_LESSONS instead keeps the tile order and the
// delivery order in lockstep by construction, the same guarantee every other
// track already has.
import { buildItem } from "./build-item.ts";
import { factInfo } from "@/lib/facts";
import { patternEntry } from "@/data/grammar";
import { CURRICULUM_LESSONS } from "@/data/grammar/lessons.ts";
import type { ContentItem } from "./item.ts";
import type { GrammarProductionUnit } from "./teach-unit.ts";

/** The distinct grammar pattern entries, each as a ContentItem via `buildItem`,
 * in CURRICULUM_LESSONS teaching order. One entry per CURRICULUM_LESSONS entry
 * (its `primaryPattern`, already the one representative of its pattern group —
 * see `isPrimaryPatternRecipe`/`patternGroup` in recipes.ts), deduped as a
 * safety net rather than a load-bearing filter. Undefined builds are skipped. */
export function grammarItems(): ContentItem[] {
  const seen = new Set<string>();
  const items: ContentItem[] = [];
  for (const lesson of CURRICULUM_LESSONS) {
    const entry = patternEntry(lesson.primaryPattern);
    if (seen.has(entry as string)) continue;
    seen.add(entry as string);
    const item = buildItem(entry, "grammar");
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

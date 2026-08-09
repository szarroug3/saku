// itemCost — how much learning an item is, read straight off its facts.
//
// The owner's difficulty model (difficulty.ts) defines cost as "the number of
// distinct things a learner must attach": a meaning is 1, each reading is 1.
// Those ARE the item's facts. `glyphDifficulty` is a glyph-centric implementation
// of that count — right for kanji/words, but it prices a kana 〜つ form or a rule
// unit at 0 because they aren't glyph-role things. Reading the count off `facts`
// instead is the same model, generalized to EVERY kind: a new fact (a mic
// "say it") or a whole new content kind is priced correctly with no new code.
//
// This is meant to replace `glyphDifficulty` as the ONE cost axis across all
// tracks; that global fold-in is its own deliberate step (it shifts kanji/word
// sizing, since fact-count and glyphDifficulty differ for multi-role glyphs like
// 日). For now the shared scheduler prices with this.

import type { ContentItem } from "./item";

/**
 * The learning cost of an item: one per fact. `buildItem` refuses a fact-less
 * entry, so every real item costs at least 1 — the scheduler's budget always
 * advances (no more 0-cost items stalling the fill). Weight per fact-kind later
 * if a hard production should count more than a bare meaning.
 */
export function itemCost(item: ContentItem): number {
  return item.facts.length;
}

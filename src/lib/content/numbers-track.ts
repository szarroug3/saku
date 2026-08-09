// The numbers/counters track, expressed in the shared content model — the pilot
// migration off counter-lesson.ts's hand-rolled scheduler.
//
// The track has two item shapes:
//   - ENTRY-BACKED forms (the 〜つ natives, 二十歳, はたち …): ordinary entries
//     buildItem handles — see `orderedTrack` for the base spec (later piece).
//   - GENERATIVE-RULE units (compose 11-99, the big words, each counter): these
//     have NO normal entry buildItem can read, so `unitItem` builds them here.
//
// This file is the track-specific glue, so it is the right (only) place to import
// counter-lesson.ts's curriculum data into the content model; the generic
// content infra stays free of it.

import { entryOf } from "@/lib/facts";
import { constructionFactForMarker } from "@/data/counter-categories";
import { kanjiEntry } from "@/data/kanji";
import { UNIT_KANJI, type NumberUnit } from "@/lib/counter-lesson";
import { buildItem } from "./build-item";
import type { ContentItem } from "./item";

/**
 * A generative unit as a ContentItem. Its drillable fact lives under the
 * category-fact's entry (`word:counter:cat:hon`), which `buildItem` reads for the
 * facts, roles, and display glyph (十〜, 〜本). Only the prerequisites are
 * bespoke: the unit's own kanji (`UNIT_KANJI` — the ten Sino numbers for `tens`,
 * the big words for `big`, the counter kanji for a counter), which buildItem
 * can't infer from a rule card. The scheduler follows THOSE kanji's own Built-from
 * edges transitively and depth-gates, so this supplies only the direct level.
 *
 * Undefined if the unit has no category fact or that entry has no facts — a
 * caller can't mint a hollow unit, the same refusal buildItem makes.
 */
export function unitItem(unit: NumberUnit): ContentItem | undefined {
  const fact = constructionFactForMarker(unit.marker);
  if (!fact) return undefined;
  const base = buildItem(entryOf(fact), "generative-rule");
  if (!base) return undefined;
  return { ...base, prereqs: UNIT_KANJI[unit.id].map((c) => kanjiEntry(c)) };
}

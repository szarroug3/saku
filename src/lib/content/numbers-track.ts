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
import { counterEntry, type CounterForm } from "@/data/counters";
import { kanjiEntry } from "@/data/kanji";
import { SCHEDULE, UNIT_KANJI, type NumberUnit } from "@/lib/counter-lesson";
import { buildItem } from "./build-item";
import type { ContentItem } from "./item";
import type { Track } from "./track";

/**
 * An entry-backed counter form as a ContentItem — the `〜つ` natives (kana,
 * meaning only) and the tail (二十歳 は，reading + meaning). Wholly `buildItem`'s
 * job: the form's facts hang off `counterEntry(form)`, and its kanji prereqs
 * (only 二十歳 has any) fall out of the glyph. Kept beside `unitItem` so the
 * SCHEDULE walk (next piece) reads formItem(step.form) / unitItem(step.unit).
 */
export function formItem(form: CounterForm): ContentItem | undefined {
  return buildItem(counterEntry(form), "counter");
}

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

/**
 * The numbers/counters track: the whole curriculum as ContentItems, in teaching
 * order, by walking the SAME `SCHEDULE` the live scheduler uses (〜つ natives, the
 * two range units, then each counter's unit followed by its kept forms). Building
 * both item shapes off the one schedule is what makes the shared `nextLesson`
 * reproduce this track — a step that can't build (missing facts) is dropped, the
 * same refusal `formItem`/`unitItem` make.
 *
 * Order ONLY — dueness, prereq resolution, budget, and the depth gate are the
 * scheduler's (see track.ts). The order is static, so history is ignored and the
 * items are built once.
 */
export function numbersTrack(): Track {
  const items: ContentItem[] = [];
  for (const step of SCHEDULE) {
    const item = "unit" in step ? unitItem(step.unit) : formItem(step.form);
    if (item) items.push(item);
  }
  return { id: "counters", order: () => items };
}

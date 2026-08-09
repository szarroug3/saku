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
import { wordEntry } from "@/data/vocab";
import { SCHEDULE, UNIT_KANJI, type NumberUnit } from "@/lib/counter-lesson";
import { buildItem } from "./build-item";
import type { ContentItem } from "./item";
import type { Track } from "./track";

/**
 * A bare Sino number (一, 三, 百, 万) as a first-class track item — the NUMBER
 * word (word:三 = さん, "three"), reading + meaning + Built-from, not the kanji
 * entry. Its character is pulled first as the word's own Built-from prereq, the
 * same way every kanji-word teaches its kanji (生 before 先生). Undefined if the
 * glyph has no number word.
 */
function numberWordItem(glyph: string): ContentItem | undefined {
  return buildItem(wordEntry(glyph), "number");
}

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
 * the item shapes off the one schedule is what makes the shared `nextLesson`
 * reproduce this track — a step that can't build (missing facts) is dropped, the
 * same refusal `formItem`/`unitItem` make.
 *
 * The bare Sino numbers (一…十, 百千万) are FIRST-CLASS items here, not just unit
 * prereqs: a `tens`/`big` range unit is preceded by its numbers as number-word
 * items (they compose 11-99 / 100-9999 out of exactly those). Counter units keep
 * their kanji as prereqs — 本 is a counter, not a number. This is what makes
 * "1, 2, 3, 4 …" appear in the number track's own list.
 *
 * Order ONLY — dueness, prereq resolution, budget, and the depth gate are the
 * scheduler's (see track.ts). The order is static, so history is ignored and the
 * items are built once.
 */
export function numbersTrack(): Track {
  const items: ContentItem[] = [];
  for (const step of SCHEDULE) {
    if ("unit" in step) {
      // A bare-number range: teach its Sino numbers as items before the rule.
      if (step.unit.kind === "tens" || step.unit.kind === "big") {
        for (const g of UNIT_KANJI[step.unit.id]) {
          const n = numberWordItem(g);
          if (n) items.push(n);
        }
      }
      const unit = unitItem(step.unit);
      if (unit) items.push(unit);
    } else {
      const form = formItem(step.form);
      if (form) items.push(form);
    }
  }
  return { id: "counters", order: () => items };
}

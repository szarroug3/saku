// "Look out for" — the kanji this one is confusable with, FILTERED TO THE ONES
// YOU ALREADY KNOW.
//
// WHY THE FILTER IS THE WHOLE POINT
// =================================
// `CONFUSABLE_WITH` is a distractor source: it answers "what would a reader
// reading at speed pick instead of this". On a LESSON that question has a
// prerequisite. Warning a learner meeting 休 for the first time that it looks
// like 体 is useful only if they have met 体 — otherwise the warning introduces
// an unknown character in order to caution about it, which is teaching two
// things while claiming to teach one, and the reader has no way to tell whether
// 体 is something they were supposed to recognise.
//
// So the row shows only the lookalikes that are already in the reader's head.
// "Already in the reader's head" is `kanjiKnown` — seen, claimed or tested,
// through `effectiveState` — the same predicate the words track gates on and the
// same model `word-unlock.ts` and `grammar/readable.ts` use one subject over.
// There is one notion of known in this app and this is a call to it.
//
// ALL OF THEM, NOT THE FIRST. `distractorsFor` takes a slice because a drill
// needs N wrong options; this is not a drill, and a reader who knows two
// lookalikes should be warned about two. The list is short by construction —
// only 77 of the 2,136 kanji have ANY lookalike before this filter runs.
//
// NO "you learned this N days ago" LINE. That is a standing dressed as prose: it
// reports the reader's history back at them on a screen whose whole promise is
// that nothing here is scored. The character and its meaning are the warning.

import { CONFUSABLE_WITH } from "@/data/confusable";
import { kanjiRow } from "@/data/kanji";
import { kanjiKnown } from "@/lib/kanji-known";
import type { HistoryFile } from "@/types";

/** A lookalike worth naming: the character, and what it means. */
export interface Lookalike {
  readonly c: string;
  readonly meaning: string;
}

/**
 * The kanji `glyph` is confusable with that the learner already knows.
 *
 * Empty for the overwhelming majority — 2,059 of 2,136 kanji have no lookalike
 * at all, and of the 77 that do, most sit beside a character the reader has not
 * reached yet. The caller renders NOTHING for an empty list; see the paired row
 * in kanji-parts-row.tsx, where an absent half hands its width to the other one.
 */
export function knownLookalikes(
  glyph: string,
  history: HistoryFile,
): readonly Lookalike[] {
  const all = CONFUSABLE_WITH.get(glyph) ?? [];
  const out: Lookalike[] = [];
  for (const c of all) {
    if (!kanjiKnown(c, history)) continue;
    out.push({ c, meaning: kanjiRow(c)?.meanings[0] ?? "" });
  }
  return out;
}

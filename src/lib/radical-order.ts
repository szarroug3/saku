// The order radicals are TAUGHT in — need-driven, one layer under the kanji order.
//
// A radical is taught just before the first kanji that needs it. The kanji track
// already has a total order (KANJI_ORDER, the everyday ramp); each kanji is filed
// under exactly one classical radical, so a radical's place in the queue is the
// place of the EARLIEST kanji that gates on it. Sort the radicals by that first
// consumer and you have taught every radical exactly once, always before the
// kanji that reveal it, with no radical arriving early for its own sake.
//
// This mirrors the kanji track's own parts-first pull-forward (PREREQUISITE_ONLY
// / pulledFor), one level down: there a kanji is pulled before the kanji that
// needs it; here a radical is pulled before the kanji that needs it. The gate the
// order serves lives in radical-unlock.ts.
//
// ORPHANS LAST. 16 of the 214 radicals index no jōyō kanji at all (爿 瓜 禸 韭 …).
// They have no first consumer, so need-driven ordering has nothing to say about
// where they go. Per the curriculum decision they are appended after every needed
// radical, among themselves in Kangxi number order, so the queue teaches
// everything a kanji will ever reference first and the unreferenced remainder as
// a tail for completeness.
//
// BROWSE ORDER IS NOT THIS. The Library shelf shows all 214 in canonical Kangxi
// number order (see shelves.tsx). This module is only the study queue.

import { KANJI_ORDER } from "@/data/kanji";
import {
  RADICALS,
  isRadicalTaughtAsKanji,
  radicalOfKanji,
  type RadicalRow,
} from "@/data/radicals";

/**
 * Every radical the radical TRACK teaches, in the order it teaches them: by
 * first consumer kanji, orphans last in Kangxi number order.
 *
 * 98 of the 214, not all of them. The 116 radicals that are also their own
 * first-consumer kanji (乙, 一, 人, 水 …) are taught ONCE, on the kanji card, so
 * they are dropped here — see `isRadicalTaughtAsKanji` in src/data/radicals.ts
 * for why teaching them twice was the redundancy this removes. What remains is
 * the 90 radical-only shapes (亠 亅 冂 …, not kanji) plus the 8 both-roles
 * characters that are needed as a component before their own kanji is reached
 * (火 玉 …) and so still earn an early radical card. The "of N" a radical lesson
 * shows counts off this list, so the denominator is the 98 the track actually
 * teaches and never double-counts a merged one against the kanji track.
 */
export const RADICAL_TEACHING_ORDER: readonly RadicalRow[] = (() => {
  // The earliest kanji-order position that gates on each radical number. A
  // radical with no entry here has no jōyō consumer — an orphan.
  const firstConsumer = new Map<number, number>();
  for (const o of KANJI_ORDER) {
    const rad = radicalOfKanji(o.c);
    if (!rad) continue;
    const seen = firstConsumer.get(rad.num);
    if (seen === undefined || o.i < seen) firstConsumer.set(rad.num, o.i);
  }

  const needed: RadicalRow[] = [];
  const orphans: RadicalRow[] = [];
  for (const r of RADICALS) {
    // Merged radicals are taught on the kanji card, never here — skip them so
    // the track, its order, and its "of N" total are the 98 it really teaches.
    if (isRadicalTaughtAsKanji(r.num)) continue;
    (firstConsumer.has(r.num) ? needed : orphans).push(r);
  }

  needed.sort((a, b) => {
    const ia = firstConsumer.get(a.num)!;
    const ib = firstConsumer.get(b.num)!;
    // First consumer decides it. Ties (two radicals whose earliest kanji is the
    // same position — impossible today since each position is one kanji with one
    // radical, but cheap to make total) fall through to Kangxi number so the
    // order is reproducible.
    return ia - ib || a.num - b.num;
  });
  orphans.sort((a, b) => a.num - b.num);

  return [...needed, ...orphans];
})();

/** A radical's index in the teaching queue, or -1 if unknown (no such radical).
 * Used to place a radical lesson relative to the kanji it precedes. */
const TEACH_INDEX: ReadonlyMap<number, number> = new Map(
  RADICAL_TEACHING_ORDER.map((r, i) => [r.num, i]),
);

export function radicalTeachIndex(num: number): number {
  return TEACH_INDEX.get(num) ?? -1;
}

/** How many jōyō kanji are filed under each radical — the "appears in N kanji"
 * a radical card shows. Zero for the 16 orphans. */
const CONSUMER_COUNT: ReadonlyMap<number, number> = (() => {
  const count = new Map<number, number>();
  for (const o of KANJI_ORDER) {
    const rad = radicalOfKanji(o.c);
    if (!rad) continue;
    count.set(rad.num, (count.get(rad.num) ?? 0) + 1);
  }
  return count;
})();

export function radicalConsumerCount(num: number): number {
  return CONSUMER_COUNT.get(num) ?? 0;
}

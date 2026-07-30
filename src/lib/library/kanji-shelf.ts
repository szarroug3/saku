// How the Kanji shelf is cut — the glyphs only, so it can be tested.
//
// This is the arithmetic half of the kanji shelf, split out of shelves.tsx for
// one reason: shelves.tsx is a .tsx and the test runner is Node's own type
// stripper, which does not do JSX. Cutting 2,136 kanji into sections that tile
// the whole set with no gap, no overlap and no duplicate is exactly the kind of
// off-by-one a test should hold, so the cut lives here and the shelf renders it.
//
// THE CUT FOLLOWS THE READER'S ORDER, NOT THE DATA'S. See the header of
// components/library/shelves.tsx for the argument.

import { KANJI, kanjiTeachOrder } from "@/data/kanji";
import { curriculumPosition } from "@/lib/curriculum-order";
import type { NewKanjiOrder } from "@/types";

/** One cut of the kanji shelf, as glyphs. The shelf turns these into entries. */
export interface KanjiCut {
  readonly id: string;
  readonly label: string;
  readonly glyphs: readonly string[];
}

/** How many kanji a range section holds.
 *
 * 50, matching the words and radicals shelves (GROUP_SIZE) so every browsable
 * subject reads in the same size ranges — "1–50", "51–100" — instead of the
 * kanji shelf alone counting by hundreds. 50 is still a round number you can
 * count in your head, and it divides 2,136 into 42 full sections and a short
 * tail of 36, small enough to look like the end of a list, not a broken one. */
export const KANJI_CHUNK = 50;

/** How many range sections the shelf actually paints.
 */
/** A kanji's place in the curriculum climb — its `curriculumPosition`, with
 * anything the spine does not teach pushed past the end so it trails the taught
 * characters instead of leading them. */
function climbRank(glyph: string): number {
  const p = curriculumPosition(glyph);
  return p === -1 ? Number.POSITIVE_INFINITY : p;
}

/**
 * The kanji shelf's sections, in the order the reader is studying in.
 *
 * `grade` KEEPS GRADE SECTIONS and every other mode gets ranges, which is not
 * an inconsistency: in `grade` mode the grades ARE the study order, so the
 * boundary between grade 3 and grade 4 is a real event in the queue and a
 * "301–400" label would hide it. In `everyday` and `newspaper` there is no such
 * event — the order is one continuous ranking — so any boundary is arbitrary
 * and a round number is the most honest arbitrary one available.
 *
 * The range modes cut the kanji in the curriculum CLIMB, not the frequency ramp:
 * `curriculumPosition` is the order the Learn feed actually reaches each
 * character, so 人 opens the shelf (kanji 1 on the Learn card) where frequency
 * once buried it. The mode's own teach order is the secondary key (Array.sort is
 * stable), so any character the spine never teaches trails the taught ones in
 * that ramp rather than leading them. Every jōyō kanji is on the spine today, so
 * that tail is empty and both range modes yield the one climb order; the
 * fallback just keeps the cut honest if the spine ever stops covering one.
 */
export function kanjiCuts(mode: NewKanjiOrder): KanjiCut[] {
  const order = kanjiTeachOrder(mode);
  if (mode === "grade") return gradeCuts(order);

  const climb = [...order].sort((a, b) => climbRank(a) - climbRank(b));

  const cuts: KanjiCut[] = [];
  for (let start = 0; start < climb.length; start += KANJI_CHUNK) {
    const glyphs = climb.slice(start, start + KANJI_CHUNK);
    cuts.push({
      id: `range-${start + 1}`,
      // An EN DASH, matching the app's counters ("kanji 1–4 of 2,136"), which
      // count items in a range and never lessons.
      label: `${start + 1}–${start + glyphs.length}`,
      glyphs,
    });
  }
  return cuts;
}

/** Grade sections, tiles inside each one in `grade` teach order.
 *
 * 1–6 and 8. THERE IS NO GRADE 7 (see KanjiRow.grade) — this reads the grades
 * that are actually present rather than iterating a range, which is how a
 * screen invents one.
 *
 * "School grade", not "jōyō grade". Jōyō is the 2,136-kanji list that IS this
 * whole shelf, so the word distinguishes nothing to the one person reading it;
 * and the wording matches the setting that chose this mode, which already says
 * "School grade order". */
function gradeCuts(order: readonly string[]): KanjiCut[] {
  const gradeOf = new Map(KANJI.map((k) => [k.c, k.grade]));
  const byGrade = new Map<number, string[]>();
  // Walking the ORDER, not KANJI, is what puts the tiles in study order: each
  // grade's bucket fills in the sequence you will meet them in.
  for (const c of order) {
    const g = gradeOf.get(c);
    if (g === undefined) continue;
    const bucket = byGrade.get(g);
    if (bucket) bucket.push(c);
    else byGrade.set(g, [c]);
  }
  return [...byGrade.keys()]
    .sort((a, b) => a - b)
    .map((g) => ({
      id: `grade-${g}`,
      label: `School grade ${g}`,
      glyphs: byGrade.get(g) ?? [],
    }));
}

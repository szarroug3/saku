// The radical track's curriculum — what to teach, and when, so that no kanji is
// ever shown before the radical it is filed under.
//
// JUST IN TIME, NOT ALL AT ONCE. The 214 radicals are not front-loaded before
// kanji begins; that would be 214 meaning cards between kana and the first kanji.
// Instead a radical is taught right before the kanji that needs it: the next
// radical lesson is the radicals of the NEXT kanji lesson group that the learner
// does not yet know. Learn those, the kanji group unlocks (kanji-lesson.ts gates
// on it), and the next group's radicals become due. Radical and kanji cards
// alternate, the radical always a step ahead — the words track's relationship to
// kanji, one layer down.
//
// ORPHANS AT THE END. 16 radicals index no jōyō kanji, so no kanji group ever
// makes them due. Once every kanji is learned (no fresh kanji group remains),
// the remaining unknown radicals — the orphans — are taught for completeness, in
// teaching order (which puts them last, in Kangxi number order). A learner who
// finishes the kanji track and wants the whole radical shelf gets them; one who
// never does is never blocked on a radical no kanji needs.
//
// PURE FUNCTION OF HISTORY, like every other track's next-lesson. No cursor: the
// same history and settings always name the same radical lesson.

import { radicalMeaningFactId, radicalOfKanji, type RadicalRow } from "@/data/radicals";
import { freshFacts, nextGroup } from "@/lib/budget";
import { kanjiCurriculum, type LessonRange } from "@/lib/kanji-lesson";
import type { LessonPosition } from "@/lib/lesson-position";
import { radicalKnown } from "@/lib/radical-known";
import {
  RADICAL_TEACHING_ORDER,
  radicalConsumerCount,
} from "@/lib/radical-order";
import type { FactId, HistoryFile } from "@/types";

/** The kanji of the next fresh kanji lesson group — the ones about to be taught,
 * whose radicals must be known first. Empty when the kanji curriculum is done. */
function nextKanjiGroupChars(
  history: HistoryFile,
  order: readonly string[],
  range: LessonRange,
): string[] {
  const groups = kanjiCurriculum(order, range);
  const fresh = freshFacts(
    groups.flatMap((g) => g.facts),
    history,
  );
  const facts = nextGroup(
    groups.map((g) => g.facts),
    fresh,
  );
  if (!facts.length) return [];
  const group = groups.find((g) => g.facts.includes(facts[0]));
  return group ? [...group.chars] : [];
}

/**
 * The radicals due to be taught now, in teaching order.
 *
 * While kanji remain: the unknown radicals of the next kanji group — teach these
 * and that group unlocks. When the kanji track is done: every remaining unknown
 * radical (the orphans), so the shelf can be completed.
 */
export function dueRadicals(
  history: HistoryFile,
  order: readonly string[],
  range: LessonRange,
): RadicalRow[] {
  const chars = nextKanjiGroupChars(history, order, range);
  if (chars.length) {
    const needed = new Set<number>();
    for (const c of chars) {
      const rad = radicalOfKanji(c);
      if (rad && !radicalKnown(rad.glyph, history)) needed.add(rad.num);
    }
    return RADICAL_TEACHING_ORDER.filter((r) => needed.has(r.num));
  }
  return RADICAL_TEACHING_ORDER.filter((r) => !radicalKnown(r.glyph, history));
}

/** One radical, ready to render on a lesson card. */
export interface RadicalCard {
  num: number;
  glyph: string;
  meaning: string;
  strokes: number;
  /** How many kanji this radical appears in — the "why learn it" number. */
  appearsIn: number;
}

/** The next radical lesson. */
export interface RadicalLesson {
  cards: RadicalCard[];
  facts: FactId[];
  /** Where you are, in RADICALS — "3-6 of 214", counted off the teaching order
   * so a learner sees the whole 214 as the denominator. */
  position: LessonPosition;
}

function toCard(r: RadicalRow): RadicalCard {
  return {
    num: r.num,
    glyph: r.glyph,
    meaning: r.meaning,
    strokes: r.strokes,
    appearsIn: radicalConsumerCount(r.num),
  };
}

/**
 * The next radical lesson, or null when nothing is due.
 *
 * `perLesson` caps how many radicals a single card teaches; the due list is
 * sliced to it, so a kanji group that needs five new radicals may take two
 * radical cards before it unlocks. A function of history and the kanji curriculum
 * settings (the radical order is derived from the kanji order), like every card.
 */
export function nextRadicalLesson(
  history: HistoryFile,
  order: readonly string[],
  range: LessonRange,
  perLesson: number,
): RadicalLesson | null {
  const due = dueRadicals(history, order, range);
  if (!due.length) return null;

  const size = Math.max(1, Math.floor(perLesson));
  const batch = due.slice(0, size);

  // Position is counted off how many radicals are already known, so the card
  // reads as progress through the 214 rather than through the due sublist.
  const knownCount = RADICAL_TEACHING_ORDER.filter((r) =>
    radicalKnown(r.glyph, history),
  ).length;

  return {
    cards: batch.map(toCard),
    facts: batch.map((r) => radicalMeaningFactId(r.glyph)),
    position: {
      from: knownCount + 1,
      to: knownCount + batch.length,
      total: RADICAL_TEACHING_ORDER.length,
    },
  };
}

/** Has the learner met any radical yet? Drives whether the radical card stays on
 * screen once opened, the way the other tracks track their own start. */
export function hasStartedRadicalTrack(history: HistoryFile): boolean {
  return RADICAL_TEACHING_ORDER.some((r) => radicalKnown(r.glyph, history));
}

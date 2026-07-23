// "Do I know this radical?" and "is this kanji's radical learned yet?" — the gate
// one layer below kanji-known.ts.
//
// The kanji track gates a word on its kanji (kanji-known.ts / word-lesson.ts):
// 電車 waits for 電 and 車. The radical track gates a kanji on its radical the
// same way: 海 waits for 氵 (water). A kanji is not teachable until the meaning of
// the radical it is filed under has been learned, so a breakdown never shows a
// shape the learner has never met.
//
// It is the model word-unlock.ts, kanji-known.ts and grammar/readable.ts already
// share, one subject down: learned means seen, claimed, or tested, read through
// effectiveState so a CLAIM ("I already know this") counts exactly as a lesson
// does. Every kanji maps to exactly one classical radical, so the gate is a
// single predicate, not an all-parts closure like a word's.

import {
  isRadicalTaughtAsKanji,
  radicalMeaningFactId,
  radicalOfKanji,
} from "@/data/radicals";
import { effectiveState } from "@/lib/claims";
import type { HistoryFile } from "@/types";

/**
 * A radical is KNOWN once its MEANING has been learned — seen, claimed, or tested.
 *
 * The one fact a radical carries. Same "not fresh" signal every other track gates
 * on, read here for a radical's meaning fact. `glyph` is the radical's glyph, the
 * key its entry and fact are minted from.
 */
export function radicalKnown(glyph: string, history: HistoryFile): boolean {
  const fact = radicalMeaningFactId(glyph);
  const state = effectiveState(
    history.facts[fact],
    history.claims?.[fact],
    history.seen?.[fact],
  );
  return state.lastTested > 0;
}

/**
 * Is this kanji's radical learned yet? The gate the kanji track turns on — a
 * kanji is teachable only once the radical it is filed under is known.
 *
 * True for a kanji with no mapped radical, which cannot happen for a jōyō kanji
 * (the ingest fails rather than ship one) but is the safe answer: a kanji the
 * radical data does not cover is not blocked by a radical it does not have.
 *
 * Also true when the radical is a MERGED one — a both-roles character taught as
 * its own kanji rather than as a separate radical card (乙, 一, 人 …). There is
 * no radical card to wait on: the radical IS a kanji, taught in the kanji order
 * at the exact point it is first needed (it is its own first consumer). So it is
 * never a separate prerequisite and never gates. The character teaches itself,
 * and later kanji filed under the same radical are unblocked the moment it lands
 * in the order ahead of them. See `isRadicalTaughtAsKanji` in data/radicals.ts.
 */
export function kanjiRadicalKnown(c: string, history: HistoryFile): boolean {
  const rad = radicalOfKanji(c);
  if (!rad) return true;
  if (isRadicalTaughtAsKanji(rad.num)) return true;
  return radicalKnown(rad.glyph, history);
}

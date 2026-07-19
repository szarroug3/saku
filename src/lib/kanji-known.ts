// "Do I know this kanji?" — one definition, three callers.
//
// The words track already asked this: 電車 is not teachable until both 電 and 車
// are learned, and `wordTeachable` gated on a private `kanjiKnown` in
// word-lesson.ts. The lesson's "Look out for" row asks the SAME question of a
// lookalike — 休 is worth warning about beside 体 only if you have met 体 — so
// the predicate is lifted here rather than written a second time.
//
// It is the model `word-unlock.ts` and `grammar/readable.ts` already share, one
// subject over: learned means seen, claimed, or tested, read through
// `effectiveState` so a CLAIM ("I already know this") counts exactly as a lesson
// does. A re-implementation always forgets `claims`, and that is the half that
// makes a returning learner's screen wrong.
//
// It lives in its own file, not in word-lesson.ts, because word-lesson.ts pulls
// in the whole 3 MB vocabulary and this is asked from a lesson step that has no
// other reason to.

import { kanjiRow, meaningFactId } from "@/data/kanji";
import { effectiveState } from "@/lib/claims";
import type { HistoryFile } from "@/types";

/**
 * A kanji is KNOWN once its MEANING has been learned — seen, claimed, or tested.
 *
 * The meaning, not the readings, and that split is the whole unlock model: a
 * kanji's readings open one word at a time (word-unlock.ts) long after the
 * character itself is familiar. "Have you met this shape" is the meaning fact.
 *
 * False for a character with no card at all, which is the right answer rather
 * than a lookup failure: you cannot have learned something the app never taught.
 */
export function kanjiKnown(c: string, history: HistoryFile): boolean {
  if (!kanjiRow(c)) return false;
  const fact = meaningFactId(c);
  const state = effectiveState(
    history.facts[fact],
    history.claims?.[fact],
    history.seen?.[fact],
  );
  return state.lastTested > 0;
}

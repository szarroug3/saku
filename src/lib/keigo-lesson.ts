// The keigo track's curriculum: the sets the app teaches, in teaching order.
//
// WHY THIS EXISTS — the same reason transitivity-lesson.ts does. A keigo set's
// item is BLOCKED BY its PRIMARY plain verb (keigo-unit.ts's `keigoItems()`
// gates on `set.plain[0]`, the closest single-verb stand-in for "opens on ANY
// of its plain verbs" — see that file's own header for why blockedBy can't
// express the real ANY-of relationship). A set whose primary plain verb is
// never a curriculum word can therefore never unlock, so it does not belong on
// the shelf, in search, or in the schedule — the same content-gap shape
// transitivity had (see transitivity-lesson.ts, and docs/interleaved-schedule-
// findings.md for the bug this pattern caused there before it was fixed here
// pre-emptively).
//
// KEIGO_SETS is small and, today, fully reachable (every plain verb is common
// enough to already be a curriculum word) — this filter changes nothing yet.
// It exists so a future curriculum re-cut that drops a plain verb fails safe
// (the set quietly stops being offered) instead of failing exactly like
// transitivity's did (a permanently-stuck ghost unit, silently shown as if it
// were real, reachable content).

import { isCurriculumWord } from "@/lib/word-rank";
import { KEIGO_SETS, type KeigoSet } from "@/data/keigo";

/** Whether a set's PRIMARY plain verb is a word the app actually teaches — the
 * formulaic phrase (no plain verb at all) is always in, since it has nothing to
 * gate on. Mirrors keigoItems()'s own blockedBy gate exactly, so a set that
 * passes this filter is a set that CAN unlock, not just one that plausibly
 * should. */
function setInCurriculum(set: KeigoSet): boolean {
  return set.formulaic === true || isCurriculumWord(set.plain[0]!.keb);
}

/**
 * The sets the track teaches: every set whose primary plain verb is in the
 * words curriculum (or has none at all). KEIGO_SETS is already sorted by gate-
 * verb beginnerRank (see its own doc comment), so filtering it preserves
 * teaching order without re-deriving it.
 */
export const CURRICULUM_KEIGO_SETS: readonly KeigoSet[] = KEIGO_SETS.filter(setInCurriculum);

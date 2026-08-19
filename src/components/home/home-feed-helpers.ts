import type { FactId } from "@/types";

/** The `teach` array startSentence (home-feed.tsx) hands to startSession.
 *
 * On a real "Start" (`teach: true`) the marker rides ALONGSIDE the drill
 * facts, because `sessionKnownClaimTarget` (src/lib/session.ts) reads `teach`
 * as its end-of-session claim candidate set whenever `teach` is non-empty —
 * leaving the marker out means the tier can never be claimed known, whether
 * the session ends early or reaches the normal completion screen (SAK-86).
 *
 * On a Quiz-me (`teach: false`) the marker must stay OUT: a non-empty `teach`
 * always opens the lesson (`initialSessionPhase`), which is exactly SAK-85
 * (Quiz-me opening the teach screen instead of the quiz). Quiz-me records the
 * marker separately via `markSeen`/`seededSeen` in `startSentence` itself, so
 * it does not need a seat in `teach` to be tracked. */
export function sentenceSessionTeach(
  teach: boolean,
  drillFacts: FactId[],
  marker: FactId,
): FactId[] {
  return teach ? [...drillFacts, marker] : [];
}

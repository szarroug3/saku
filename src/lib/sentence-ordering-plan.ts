// The sentence-ordering track's LESSON PLANNING — pure functions of history,
// lifted out of home-feed.tsx so the feed component carries rendering and these
// carry the curriculum math. Pure and free of React, so they are unit-testable
// directly instead of only through the component.

import { patternMeaningFactId } from "@/data/grammar";
import {
  SENTENCE_ORDERING_TIERS,
  readableAssemblyForTier,
  tierAssemblyFacts,
} from "@/data/assembly";
import { effectiveState } from "@/lib/claims";
import {
  sentenceTierDone,
  sentenceTierMarkerFact,
} from "@/lib/sentence-ordering-progress";
import type { SentenceOrderingLesson } from "@/components/lesson/next-sentence-ordering-lesson";
import type { FactId, HistoryFile } from "@/types";

/** How many assembly items a sentence-ordering sitting hands out. */
export const SENTENCE_ORDERING_PER_LESSON = 12;

export function sentenceLessonFacts(
  tier: (typeof SENTENCE_ORDERING_TIERS)[number],
  history: HistoryFile,
): FactId[] {
  const facts = tierAssemblyFacts(tier, history);
  if (facts.length > 0) return facts;
  // Fallback marker so the tier can still be surfaced/completed even when no
  // pattern meaning fact can be resolved for its readable examples.
  return [sentenceTierMarkerFact(tier.id)];
}

function sentenceTierUnlocked(
  tier: (typeof SENTENCE_ORDERING_TIERS)[number],
  history: HistoryFile,
): boolean {
  const readable = readableAssemblyForTier(tier, history);
  if (readable.length < tier.minReadable) return false;

  // Grammar prereq: at least one of this tier's patterns must have been
  // taught in the grammar track (seen, claimed or tested). The simple tier
  // has no prereqs.
  if (tier.grammarPrereqs.length > 0) {
    const prereqMet = tier.grammarPrereqs.some((id) => {
      const fid = patternMeaningFactId(id);
      const st = effectiveState(
        history.facts[fid],
        history.claims?.[fid],
        history.seen?.[fid],
      );
      return st.lastTested > 0;
    });
    if (!prereqMet) return false;
  }

  return true;
}

/**
 * Find the next unlocked sentence-ordering tier lesson, or null.
 *
 * Written as a plain for-loop so the React Compiler can handle the control flow
 * without skipping memoization of the useMemo that used to wrap it.
 */
export function nextSentenceOrderingLesson(
  kanaComplete: boolean,
  history: HistoryFile,
): SentenceOrderingLesson | null {
  if (!kanaComplete) return null;

  for (let i = 0; i < SENTENCE_ORDERING_TIERS.length; i++) {
    const tier = SENTENCE_ORDERING_TIERS[i];
    // Sentence track is intentionally linear: you do not skip into a later tier
    // while an earlier one is still unavailable or unfinished.
    if (!sentenceTierUnlocked(tier, history)) return null;

    const facts = sentenceLessonFacts(tier, history);

    if (sentenceTierDone(tier.id, facts, history)) continue;

    return {
      facts: facts.slice(0, SENTENCE_ORDERING_PER_LESSON),
      lessonNumber: i + 1,
      totalLessons: SENTENCE_ORDERING_TIERS.length,
      tierId: tier.id,
      tierLabel: tier.label,
    };
  }
  return null;
}

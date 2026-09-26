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
import type { FactId } from "@/types/facts";
import type { HistoryFile } from "@/types/store";

export interface SentenceOrderingLesson {
  facts: FactId[];
  lessonNumber: number;
  totalLessons: number;
  tierId: string;
  tierLabel: string;
}

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

/** What a tier is still waiting on, or null when it is open.
 *
 * This is `sentenceTierUnlocked` with its reason kept rather than thrown away.
 * The planner only needs the yes or no, but the Observatory lists a tier it
 * cannot start yet in its place in the track and says on the card WHY it is
 * shut (SAK-430), and a second opinion about what unlocks a tier is exactly
 * the drift that would let the picker offer a lesson the planner refuses. */
export type SentenceTierBlock =
  /** These of the tier's patterns are not taught yet. The tier opens once
   * EVERY one of its patterns is (SAK-490), so only the missing ones are
   * listed. */
  | { readonly kind: "grammar"; readonly patterns: readonly string[] }
  /** Too few sentences in the tier's structural pool for a real drill. */
  | { readonly kind: "sentences"; readonly have: number; readonly need: number };

export function sentenceTierBlock(
  tier: (typeof SENTENCE_ORDERING_TIERS)[number],
  history: HistoryFile,
): SentenceTierBlock | null {
  const readable = readableAssemblyForTier(tier, history);
  if (readable.length < tier.minReadable) {
    return { kind: "sentences", have: readable.length, need: tier.minReadable };
  }

  // Grammar prereqs: EVERY one of this tier's patterns must have been taught
  // in the grammar track (seen, claimed or tested). It used to be any one of
  // them, so a learner who had met は was offered Simple without が and を.
  // Sam, 2026-09-26: "the sentence rule should be blocked until all of its
  // requirements are known" (SAK-490). A tier with no prereqs listed skips
  // this check.
  const missing = tier.grammarPrereqs.filter((id) => !patternTaught(id, history));
  if (missing.length > 0) return { kind: "grammar", patterns: missing };

  return null;
}

/** Whether a grammar pattern has been taught: its meaning fact seen, claimed
 * or tested. */
function patternTaught(id: string, history: HistoryFile): boolean {
  const fid = patternMeaningFactId(id);
  return effectiveState(history.facts[fid], history.claims?.[fid], history.seen?.[fid]).lastTested > 0;
}

function sentenceTierUnlocked(
  tier: (typeof SENTENCE_ORDERING_TIERS)[number],
  history: HistoryFile,
): boolean {
  return sentenceTierBlock(tier, history) === null;
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

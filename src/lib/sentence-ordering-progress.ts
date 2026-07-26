import type { FactId, HistoryFile } from "@/types";
import {
  SENTENCE_ORDERING_TIERS,
  tierAssemblyFacts,
} from "@/data/assembly";

/** Track-local completion marker. It is intentionally not a registered quiz
 * fact: it records an explicit "I already know this tier" action without
 * pretending that a grammar meaning claim completed sentence-order practice. */
export function sentenceTierMarkerFact(tierId: string): FactId {
  return `grammar:sentence-ordering-tier/${tierId}` as FactId;
}

export function isSentenceTierMarkerFact(fact: FactId): boolean {
  return fact.startsWith("grammar:sentence-ordering-tier/");
}

/** A tier advances through either explicit completion path:
 *
 *  - the learner chose "I already know this" for this exact tier; or
 *  - an assembly-mode session recorded at least one answered fact belonging to
 *    this tier.
 *
 * One answered fact is enough because the session itself owns coverage and
 * completion. Requiring every tier fact here made a completed limited session
 * impossible to advance from.
 */
export function sentenceTierDone(
  tierId: string,
  facts: readonly FactId[],
  history: HistoryFile,
): boolean {
  if (history.claims?.[sentenceTierMarkerFact(tierId)] !== undefined) return true;
  const tierFacts = new Set(facts);
  return history.sessions.some(
    (session) =>
      session.mode === "assembly" &&
      Object.entries(session.facts).some(
        ([fact, counts]) => tierFacts.has(fact as FactId) && counts.seen > 0,
      ),
  );
}

/** Sentence types the learner has explicitly claimed or completed in assembly. */
export function learnedSentenceTierIds(history: HistoryFile): string[] {
  return SENTENCE_ORDERING_TIERS.filter((tier) =>
    sentenceTierDone(tier.id, tierAssemblyFacts(tier, history), history),
  ).map((tier) => tier.id);
}

/** Non-drill markers that carry learned sentence-type scope into assembly. */
export function learnedSentenceTierFacts(history: HistoryFile): FactId[] {
  return learnedSentenceTierIds(history).map(sentenceTierMarkerFact);
}

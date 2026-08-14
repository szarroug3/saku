// Which sentence-ordering tiers the learner has LEARNED — the progress queries that
// need the assembly corpus (`tierAssemblyFacts`) to know a tier's facts.
//
// Split from sentence-ordering-progress.ts because that module must stay content-
// free (quiz-session.tsx imports its marker predicate and is a GLOBAL provider). The
// assembly corpus pulls the ~8.6 MB dictionary, so it belongs only in the modules
// that genuinely query learned scope — practice/stats/assembly screens — never on
// the global session provider's path.

import {
  SENTENCE_ORDERING_TIERS,
  tierAssemblyFacts,
} from "@/data/assembly";
import {
  sentenceTierDone,
  sentenceTierMarkerFact,
} from "@/lib/sentence-ordering-progress";
import type { FactId, HistoryFile } from "@/types";

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

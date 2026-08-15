// CONTENT-FREE. This module holds the sentence-ordering PROGRESS primitives — the
// tier marker fact-id and completion checks — that read only history, so it does
// NOT import the assembly corpus (and, through it, the ~8.6 MB dictionary). That
// matters because quiz-session.tsx imports `isSentenceTierMarkerFact` and is mounted
// GLOBALLY (QuizSessionProvider in the root layout), so any dictionary edge here
// would land the dictionary on every route. The functions that DO need the corpus —
// `learnedSentenceTierIds`/`learnedSentenceTierFacts` — live in
// sentence-ordering-learned.ts for exactly that reason.

import type { EntryId, FactId, HistoryFile } from "@/types";

/** The Library/teaching entry for a sentence tier. */
export function sentenceTierEntry(tierId: string): EntryId {
  return `sentence-ordering:${tierId}` as EntryId;
}

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

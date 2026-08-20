// SAK-104: claimableFacts/quizzableFacts, split out of the server-only
// library-index.ts so slice-bar.tsx (a hot, frequently-re-rendered client
// component) can keep computing them synchronously every render instead of a
// round trip per keystroke/click. See reading-proof-facts.json's own build
// comment (scripts/build-library-index.mjs) for why this slice is safe to
// ship: no search text, no glosses, ~3,500 fact-id -> fact-id[] proofs only.
//
// Behaviour is byte-identical to library-index.ts's own claimableFacts/
// quizzableFacts/isReadingFact — same source data, same logic, just read from
// its own small file instead of the ~9.5MB index.

import readingProofFactsJson from "@/data/generated/reading-proof-facts.json" with { type: "json" };
import { effectiveState } from "@/lib/claims";
import type { FactId, HistoryFile } from "@/types";

const READING_PROOF_FACTS: Readonly<Record<string, readonly FactId[]>> =
  readingProofFactsJson.readingProofFacts as unknown as Readonly<
    Record<string, readonly FactId[]>
  >;

export function isReadingFact(fact: FactId): boolean {
  return READING_PROOF_FACTS[fact as unknown as string] !== undefined;
}

export function claimableFacts(facts: readonly FactId[]): FactId[] {
  return facts.filter((fact) => !isReadingFact(fact));
}

export function quizzableFacts(
  facts: readonly FactId[],
  history: HistoryFile,
): FactId[] {
  return facts.filter((fact) => {
    const proofs = READING_PROOF_FACTS[fact as unknown as string];
    if (proofs === undefined) return true;
    return proofs.some((proof) => {
      const state = effectiveState(
        history.facts[proof],
        history.claims?.[proof],
        history.seen?.[proof],
      );
      return state.lastTested > 0;
    });
  });
}

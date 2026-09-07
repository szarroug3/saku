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
  return facts.filter((fact) => quizzable(fact, history));
}

/** Whether a proof counts: the same test `quizzable` puts each proof to. */
function proves(proof: FactId, history: HistoryFile): boolean {
  const state = effectiveState(history.facts[proof], history.claims?.[proof], history.seen?.[proof]);
  return state.lastTested > 0;
}

/** The facts each proof stands for, the table turned around, once. */
let provenBy: Map<string, FactId[]> | undefined;
function provenByProof(proof: FactId): readonly FactId[] {
  if (!provenBy) {
    provenBy = new Map();
    for (const [fact, proofs] of Object.entries(READING_PROOF_FACTS)) for (const pr of proofs) {
      const list = provenBy.get(pr as string);
      if (list) list.push(fact as unknown as FactId); else provenBy.set(pr as string, [fact as unknown as FactId]);
    }
  }
  return provenBy.get(proof as string) ?? [];
}

/**
 * Every gated fact that is askable now, from the history's side: the facts
 * proved by any tested fact among `touched` (the facts the history has
 * anything on). Exactly the gated facts `quizzable` says yes to, found by
 * walking the few hundred touched facts instead of asking it of every gated
 * fact in the library (practice's preview does, SAK-382).
 */
export function provenReadingFacts(history: HistoryFile, touched: readonly FactId[]): ReadonlySet<FactId> {
  const out = new Set<FactId>();
  for (const f of touched) if (proves(f, history)) for (const proven of provenByProof(f)) out.add(proven);
  return out;
}

/** One fact of the above: askable now, or still waiting on a proof. Its own
 * function so a caller walking thousands of facts (practice's preview) can
 * ask without building a list to filter. */
export function quizzable(fact: FactId, history: HistoryFile): boolean {
  const proofs = READING_PROOF_FACTS[fact as unknown as string];
  if (proofs === undefined) return true;
  return proofs.some((proof) => proves(proof, history));
}

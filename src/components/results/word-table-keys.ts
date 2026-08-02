// Pure box-key helpers used by the results/round-complete table. Kept in a
// .ts module so Node's built-in test runner can import and test them directly.

import { presentationPhrase } from "@/lib/question-presentation";
import type { FactId, SessionStats } from "@/types";

export type BoxKey = string;

export function boxKeyOf(fact: FactId, phrase: string): BoxKey {
  return JSON.stringify([fact, phrase]);
}

export function factOfBoxKey(key: BoxKey): FactId | null {
  try {
    const parsed = JSON.parse(key);
    if (!Array.isArray(parsed) || typeof parsed[0] !== "string") return null;
    return parsed[0] as FactId;
  } catch {
    return null;
  }
}

export function presentationPhrasesForFact(
  fact: FactId,
  stats: SessionStats,
): string[] {
  const st = stats[fact];
  const showings = st?.showns?.length ? st.showns : st?.shown ? [st.shown] : [];
  const phrases =
    showings.length > 0
      ? showings.map((s) => presentationPhrase(fact, s))
      : [presentationPhrase(fact, st?.shown)];
  return [...new Set(phrases)];
}

export function boxKeysForFact(fact: FactId, stats: SessionStats): BoxKey[] {
  return presentationPhrasesForFact(fact, stats).map((phrase) =>
    boxKeyOf(fact, phrase),
  );
}

export function boxKeysForFacts(
  facts: FactId[],
  stats: SessionStats,
): BoxKey[] {
  return facts.flatMap((fact) => boxKeysForFact(fact, stats));
}

export function missedBoxKeysForFacts(
  facts: FactId[],
  stats: SessionStats,
): BoxKey[] {
  return facts.flatMap((fact) => {
    const st = stats[fact];
    const missed = st?.missedPhrases ?? [];
    if (missed.length) return missed.map((phrase) => boxKeyOf(fact, phrase));
    // Some older or inferred stats have miss counts but no phrase-level
    // miss list. Keep those facts visible in Needs work by falling back to all
    // presentation boxes for the fact.
    if ((st?.misses ?? 0) > 0) return boxKeysForFact(fact, stats);
    return [];
  });
}

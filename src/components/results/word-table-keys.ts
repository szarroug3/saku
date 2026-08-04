// Pure box-key helpers used by the results/round-complete table. Kept in a
// .ts module so Node's built-in test runner can import and test them directly.

import { presentationPhrase } from "@/lib/question-presentation";
import { outcomeOf, type Outcome } from "@/lib/results-grouping";
import type { FactId, SessionStats } from "@/types";

export type BoxKey = string;

/**
 * How one PRESENTATION FORM of a fact went — the per-phrase outcome the results
 * table colours each cell from. Distinct from `outcomeOf`, which grades the
 * whole fact: a fact asked three ways with one typo is "recovered" as a fact,
 * but two of its three forms were first-try and must read that way.
 *
 * The rule: populated `missedPhrases` is authoritative PER PHRASE. A phrase in
 * the set was missed (recovered if the fact ever landed, else missed); a phrase
 * ABSENT from a non-empty set was clean here, regardless of a sibling phrase's
 * miss. Only an EMPTY missed set paired with a recorded miss is unattributable
 * — a miss the drill couldn't pin to a phrase — and only then do we fall back
 * to the fact-level outcome so the miss still surfaces somewhere.
 */
export function outcomeForPhrase(
  st: SessionStats[FactId] | undefined,
  phrase: string,
): Outcome {
  if (!st || st.seen === 0) return "unseen";
  const hasPhraseMissData = Array.isArray(st.missedPhrases);
  if (hasPhraseMissData) {
    const missed = new Set(st.missedPhrases ?? []);
    if (missed.has(phrase)) return st.everCorrect ? "recovered" : "missed";
    if (missed.size === 0 && st.misses > 0) return outcomeOf(st);
    return "first-try";
  }
  if (st.firstTryCorrect === true) return "first-try";
  // Legacy/inferred sessions may lack phrase-level evidence.
  return outcomeOf(st);
}

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

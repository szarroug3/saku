// The text relationships Match pairs can honestly deal.

import { patternMeaningFactId } from "@/data/grammar";
import { jp2enResponse } from "@/lib/ask-forms";
import { questionsFor, revealFor } from "@/lib/engine/question";
import { factInfo } from "@/lib/facts";
import { readableRecognition } from "@/lib/listen-sentence";
import type { FactId, HistoryFile, PairResponse } from "@/types";

const HAS_KANJI = /\p{Script=Han}/u;

export interface PairSpec {
  /** Stable within a run; variants of one fact must remain distinct. */
  id: string;
  fact: FactId;
  kind: PairResponse;
  japanese: string;
  answer: string;
  context?: string | null;
}

function definitionSpec(fact: FactId): PairSpec | null {
  const info = factInfo(fact);
  if (!info || jp2enResponse(fact) !== "definition") return null;
  const prompt = questionsFor(fact).prompt(fact, "jp2en");
  return {
    id: `definition:${fact}`,
    fact,
    kind: "definition",
    japanese: prompt.glyph,
    answer: revealFor(fact, "jp2en"),
    context: prompt.context,
  };
}

function romajiSpec(fact: FactId): PairSpec | null {
  const info = factInfo(fact);
  if (
    !info ||
    jp2enResponse(fact) !== "romaji" ||
    !HAS_KANJI.test(info.glyph)
  ) {
    return null;
  }
  const prompt = questionsFor(fact).prompt(fact, "jp2en");
  return {
    id: `romaji:${fact}`,
    fact,
    kind: "romaji",
    japanese: prompt.glyph,
    answer: revealFor(fact, "jp2en"),
    context: prompt.context,
  };
}

/**
 * Build every selected pair variant. Sentence translation reuses the same
 * known-word-gated corpus Drill's sentence recognition uses. One sentence is
 * chosen per selected grammar fact, with duplicate Japanese/English labels
 * refused so a matching board never has two visually correct destinations.
 */
export function pairSpecs(
  facts: readonly FactId[],
  kinds: readonly PairResponse[],
  history: HistoryFile,
): PairSpec[] {
  const wanted = new Set(facts);
  const out: PairSpec[] = [];
  if (kinds.includes("definition")) {
    for (const f of facts) {
      const spec = definitionSpec(f);
      if (spec) out.push(spec);
    }
  }
  if (kinds.includes("romaji")) {
    for (const f of facts) {
      const spec = romajiSpec(f);
      if (spec) out.push(spec);
    }
  }
  if (kinds.includes("sentence")) {
    const usedJp = new Set<string>();
    const usedEn = new Set<string>();
    const usedFact = new Set<FactId>();
    for (const ex of readableRecognition(history)) {
      if (!ex.jp.trim() || !ex.en.trim()) continue;
      if (usedJp.has(ex.jp) || usedEn.has(ex.en)) continue;
      const fact = ex.p
        .map(patternMeaningFactId)
        .find((f) => wanted.has(f) && !usedFact.has(f));
      if (!fact) continue;
      out.push({
        id: `sentence:${fact}:${ex.id}`,
        fact,
        kind: "sentence",
        japanese: ex.jp,
        answer: ex.en.trim(),
      });
      usedFact.add(fact);
      usedJp.add(ex.jp);
      usedEn.add(ex.en);
    }
  }
  // A matching deck must not contain two visually correct destinations.
  // Context is part of the Japanese cell ("meaning" vs "reading", or an anchor
  // word), so it participates in that side's identity; answer text stands
  // alone and must be globally unique.
  const left = new Set<string>();
  const right = new Set<string>();
  return out.filter((spec) => {
    const l = `${spec.japanese}\u0000${spec.context ?? ""}`;
    const r = spec.answer.trim().toLowerCase();
    if (!r || left.has(l) || right.has(r)) return false;
    left.add(l);
    right.add(r);
    return true;
  });
}

/** Facts that can produce at least one selected variant, for Start gating. */
export function pairFacts(
  facts: readonly FactId[],
  kinds: readonly PairResponse[],
  history: HistoryFile,
): FactId[] {
  return [...new Set(pairSpecs(facts, kinds, history).map((p) => p.fact))];
}

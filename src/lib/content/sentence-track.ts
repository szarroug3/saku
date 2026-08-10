// SENTENCE-ORDERING track — the ContentItems and SentenceBuildUnits for the
// hand-authored sentence-building tiers (src/data/assembly.ts + sentence-ordering
// -guides.ts). We teach how to BUILD a sentence of each structure, not any one
// sentence — so a tier is ONE SentenceBuildUnit: its rule (the guide's hook) and
// a worked example.
//
// This does NOT invent a model. The tiers, their curriculum order, the guides and
// the curated example sentences already exist; each tier already has its own
// progress fact (`sentenceTierMarkerFact` — deliberately distinct from the grammar
// meaning facts, since ordering practice is not the same as knowing the pattern).
// This file only re-expresses that data as the shared content model.
//
// UNLOCK. A tier's real gate (readable-vocabulary count + ANY of its grammar
// patterns taught) lives in sentence-ordering-plan.ts and is ANY-of, which the
// content model's all-of `blockedBy` can't yet express — so the gate is NOT
// duplicated here as blockedBy. The tiers are ordered simplest→complex as the
// curriculum already has them.

import { contentTypeLabel } from "./item";
import {
  SENTENCE_ORDERING_TIERS,
  readableAssemblyForTier,
  type AssemblyTier,
} from "@/data/assembly";
import { SENTENCE_ORDERING_GUIDES } from "@/data/sentence-ordering-guides";
import { sentenceTierMarkerFact } from "@/lib/sentence-ordering-progress";
import { VOCAB_FACTS } from "@/data/vocab";
import { GRAMMAR_FACTS } from "@/data/grammar";
import { emptyHistory, applyClaims } from "@/lib/history-ops";
import { jp2enResponse } from "@/lib/ask-forms";
import type { ContentItem } from "./item";
import type { SentenceBuildUnit } from "./teach-unit";
import type { EntryId, FactId, HistoryFile } from "@/types";

/** A learner who knows every word and grammar pattern — the reference against
 * which a tier's canonical worked example is chosen (its readable pool is then
 * the full pool). Built once. */
let fullKnowledge: HistoryFile | null = null;
function knowsEverything(): HistoryFile {
  if (fullKnowledge) return fullKnowledge;
  fullKnowledge = applyClaims(
    emptyHistory(),
    [...VOCAB_FACTS, ...GRAMMAR_FACTS].map((f) => f.id),
    1,
  );
  return fullKnowledge;
}

/** One worked example for a tier — the first of its readable sentences under full
 * knowledge, or "" if the corpus has none. */
function tierExample(tier: AssemblyTier): string {
  return readableAssemblyForTier(tier, knowsEverything())[0]?.jp ?? "";
}

/** Each sentence-ordering tier as a ContentItem. Its fact is the tier's own
 * marker (its distinct progress), its glyph the tier's learner-facing label. */
export function sentenceItems(): ContentItem[] {
  return SENTENCE_ORDERING_TIERS.map((tier) => {
    const marker = sentenceTierMarkerFact(tier.id);
    return {
      entry: `sentence-ordering:${tier.id}` as EntryId,
      kind: "sentence-ordering",
      glyph: tier.label,
      facts: [{ id: marker, kind: jp2enResponse(marker) }],
      roles: [],
      prereqs: [],
      blockedBy: [],
      etymology: null,
      typeLabel: contentTypeLabel("sentence-ordering", []),
    } satisfies ContentItem;
  });
}

/** The SentenceBuildUnit of a tier — teach how to order this structure: `rule` is
 * the guide's one-line hook, `example` a worked sentence. One unit; cost 1 (the
 * ordering skill), tracked by the tier's marker fact. */
export function sentenceBuildUnitsOf(item: ContentItem): SentenceBuildUnit[] {
  const tierId = String(item.entry).slice("sentence-ordering:".length);
  const tier = SENTENCE_ORDERING_TIERS.find((t) => t.id === tierId);
  const guide = SENTENCE_ORDERING_GUIDES[tierId as keyof typeof SENTENCE_ORDERING_GUIDES];
  return [
    {
      kind: "sentence-build",
      item,
      rule: guide?.hook ?? item.glyph,
      example: tier ? tierExample(tier) : "",
      facts: item.facts.map((f) => f.id) as FactId[],
      cost: 1,
    },
  ];
}

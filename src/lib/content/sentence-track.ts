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
// content model's all-of `blockedBy` can't express. The build script serializes
// its exact fact-id structure into learn-index.json, where /learn applies it
// before exposing a tier. The tiers stay ordered simplest→complex.

import { contentTypeLabel } from "./item";
import {
  SENTENCE_ORDERING_TIERS,
  readableAssemblyForTier,
  type AssemblyTier,
} from "@/data/assembly";
import { SENTENCE_ORDERING_GUIDES } from "@/data/sentence-ordering-guides";
import {
  sentenceTierEntry,
  sentenceTierMarkerFact,
} from "@/lib/sentence-ordering-progress";
import { VOCAB_FACTS } from "@/data/vocab";
import { GRAMMAR_FACTS } from "@/data/grammar";
import { emptyHistory, applyClaims } from "@/lib/history-ops";
import { jp2enResponse } from "@/lib/ask-forms";
import type { ContentItem } from "./item";
import type { SentenceBuildUnit } from "./teach-unit";
import type { FactId, HistoryFile } from "@/types";

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
 * marker (its distinct progress), its glyph the tier's learner-facing label.
 * `badgeNumber` is the tier's 1-based position in SENTENCE_ORDERING_TIERS — the
 * tile shows it as a compact numbered badge in place of `glyph`, which is
 * English and would overflow the glyph slot (SAK-11). */
export function sentenceItems(): ContentItem[] {
  return SENTENCE_ORDERING_TIERS.map((tier, index) => {
    const marker = sentenceTierMarkerFact(tier.id);
    return {
      entry: sentenceTierEntry(tier.id),
      kind: "sentence-ordering",
      glyph: tier.label,
      badgeNumber: index + 1,
      facts: [{ id: marker, kind: jp2enResponse(marker) }],
      roles: [],
      prereqs: [],
      blockedBy: [],
      typeLabel: contentTypeLabel("sentence-ordering", []),
    } satisfies ContentItem;
  });
}

/** The SentenceBuildUnit of a tier — teach how to order this structure: `rule` is
 * the guide's one-line hook, `example` a worked sentence. One unit; cost 1 (the
 * ordering skill), tracked by the tier's marker fact. */
export function sentenceBuildUnitsOf(item: ContentItem): SentenceBuildUnit[] {
  const tier = SENTENCE_ORDERING_TIERS.find(
    (candidate) => sentenceTierEntry(candidate.id) === item.entry,
  );
  const guide = tier
    ? SENTENCE_ORDERING_GUIDES[tier.id as keyof typeof SENTENCE_ORDERING_GUIDES]
    : undefined;
  return [
    {
      kind: "sentence-build",
      item,
      rule: guide?.hook ?? item.glyph,
      example: tier ? tierExample(tier) : "",
      facts: item.facts.map((f) => f.id) as FactId[],
      cost: 1,
      scheduling: "unit", // a tier is a whole assembly sitting on its own
    },
  ];
}

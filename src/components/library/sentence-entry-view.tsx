"use client";

// SENTENCE-ORDERING entry — the redesigned Library page for one sentence-structure
// tier ("Simple sentences", "Conditional sentences", …). A tier is not a
// character; it is a RULE about the order the pieces of a sentence go in. So this
// page teaches that order — the guide's steps and its one-line hook — and then
// shows the rule at work in one real sentence.
//
//   header
//   How the pieces are ordered  (accent) — the guide's steps, then its hook
//   In a sentence               — a real corpus sentence that follows the order
//
// Reference data only. The tier, its guide and the corpus already exist; this
// page re-expresses them, it invents no model. The item's id is
// `sentence-ordering:<tierId>` (see src/lib/content/sentence-track.ts), so the
// tier is resolved by slicing that prefix — the same resolve sentence-track uses,
// not the mark id the legacy router keys on.

import { ContentEntryHeader } from "@/components/library/content-entry-header";
import { EntrySurface, Lead, Section } from "@/components/library/entry-section";
import {
  ASSEMBLY,
  SENTENCE_ORDERING_TIERS,
  sentenceOrderingTierForItem,
} from "@/data/assembly";
import {
  SENTENCE_ORDERING_GUIDES,
  type SentenceOrderingTierId,
} from "@/data/sentence-ordering-guides";
import type { ContentItem } from "@/lib/content/item";

const PREFIX = "sentence-ordering:";

export function SentenceEntryView({ item }: { item: ContentItem }) {
  const entry = String(item.entry);
  const tierId = entry.startsWith(PREFIX) ? entry.slice(PREFIX.length) : entry;
  const tier = SENTENCE_ORDERING_TIERS.find((t) => t.id === tierId);
  const guide = SENTENCE_ORDERING_GUIDES[tierId as SentenceOrderingTierId];
  if (!tier || !guide) return null;

  // One worked sentence for this tier: the first short (≤4-piece) corpus item
  // that maps unambiguously to it. The curated exercises lead ASSEMBLY, so a
  // tier with a hand-reviewed sentence shows that; the rest fall to a generated
  // Tatoeba sentence. Absent — not empty — for a tier the corpus can't place.
  const example = ASSEMBLY.find(
    (it) => it.pieces.length <= 4 && sentenceOrderingTierForItem(it) === tier.id,
  );

  return (
    <EntrySurface>
      <ContentEntryHeader item={item} />

      <Section title="How the pieces are ordered" tone="accent">
        <Lead>{guide.title}</Lead>
        <div className="flex flex-col gap-3">
          {guide.body.map((step) => (
            <div key={step.lead}>
              <p className="text-[13.5px] font-medium leading-snug text-text">{step.lead}</p>
              <p className="mt-0.5 text-[13px] leading-relaxed text-text-muted">{step.text}</p>
            </div>
          ))}
        </div>
        {/* The one-line rule of thumb, in the accent the eyebrow wears — the
            single thing to carry away from the steps above. */}
        <p className="mt-4 text-[13px] font-medium text-accent">{guide.hook}</p>
      </Section>

      {example ? (
        <Section title="In a sentence">
          <Lead>The same order, in one real sentence:</Lead>
          <p className="font-kana text-[18px] leading-relaxed text-text">{example.jp}</p>
          <p className="mt-1.5 text-[13px] leading-relaxed text-text-muted">{example.en}</p>
        </Section>
      ) : null}
    </EntrySurface>
  );
}

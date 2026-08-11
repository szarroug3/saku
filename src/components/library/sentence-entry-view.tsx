"use client";

// SENTENCE-ORDERING entry — the redesigned Library page for one sentence-structure
// tier ("Simple sentences", "Conditional sentences", …). A tier is not a
// character; it is a RULE about the order the pieces of a sentence go in, and it
// is carried as a "sentence"-shelf MARK. So this page shows the SAME rich mark the
// shipped route showed — every intro card, its worked examples, and the accent
// highlighting — via the shared MarkView, then one more real sentence beneath it.
//
//   header (name + summary)
//   How the pieces are ordered  (accent) — the mark's intros (MarkView)
//   In a sentence               — a real corpus sentence that follows the order
//
// Reference data only. The tier maps to its mark by id (sentence-ordering:<id> →
// sentence-rule-<id>); MarkView is the one renderer both this page and the mark
// page use, so the sentence rule reads identically wherever it appears.

import { ContentEntryHeader } from "@/components/library/content-entry-header";
import { EntrySurface, Section } from "@/components/library/entry-section";
import { MarkView } from "@/components/library/mark-view";
import { SENTENCE_ORDERING_TIERS } from "@/data/assembly";
import { markEntry, markFor } from "@/data/marks";
import type { ContentItem } from "@/lib/content/item";

const PREFIX = "sentence-ordering:";

export function SentenceEntryView({ item }: { item: ContentItem }) {
  const entry = String(item.entry);
  const tierId = entry.startsWith(PREFIX) ? entry.slice(PREFIX.length) : entry;
  const tier = SENTENCE_ORDERING_TIERS.find((t) => t.id === tierId);
  // The tier's rule lives in its sentence-shelf mark — the rich content (intros,
  // worked examples, accents) the shipped route rendered.
  const mark = markFor(markEntry(`sentence-rule-${tierId}`));
  if (!tier || !mark) return null;

  return (
    <EntrySurface>
      <ContentEntryHeader typeLabel="sentence structure" title={mark.name} sub={mark.summary} />

      <Section title="How the pieces are ordered" tone="accent">
        <MarkView mark={mark} />
      </Section>
    </EntrySurface>
  );
}

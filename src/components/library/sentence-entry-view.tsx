"use client";

// SENTENCE-ORDERING entry — the redesigned Library page for one sentence-structure
// tier ("Simple sentences", "Conditional sentences", …). A tier is not a
// character; it is a RULE about the order the pieces of a sentence go in, and it
// is carried as a "sentence"-shelf MARK. So this page shows the SAME rich mark the
// shipped route showed — every intro card, its worked examples, and the accent
// highlighting — via the shared MarkView.
//
//   header (name)
//   How the pieces are ordered  (accent) — the mark's intros (MarkView)
//
// FETCHED BY ID, not built from a live ContentItem/sentenceItems() (which pulls
// VOCAB_FACTS/GRAMMAR_FACTS to build a sentence-track item this page never used
// beyond an existence check). A sentence tier's LIBRARY entry IS its mark's own
// entry id (sentence-rule-<tierId>, kind writing-rule — see
// library/entries.ts's SENTENCE_RULE_KIND branch), so `entry` here is exactly
// what MarkEntryView also fetches: the same full Mark object, unmodified.
// MarkView reads it directly and is unchanged.

import { ContentEntryHeader } from "@/components/library/content-entry-header";
import { EntrySurface, Section } from "@/components/library/entry-section";
import { MarkView } from "@/components/library/mark-view";
import { useContentEntry } from "@/lib/library/content-entries";
import type { Mark } from "@/data/marks";
import type { EntryId } from "@/types";

export function SentenceEntryView({ entry }: { entry: EntryId }) {
  const mark = useContentEntry<Mark>(entry);
  if (!mark) return null;

  return (
    <EntrySurface>
      <ContentEntryHeader typeLabel="sentence structure" title={mark.name} />

      <Section title="How the pieces are ordered">
        <MarkView mark={mark} />
      </Section>
    </EntrySurface>
  );
}

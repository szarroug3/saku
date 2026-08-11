"use client";

// MARK entry — the redesigned Library page for one reading rule (゛ dakuten, っ,
// long vowels, rendaku, punctuation, okurigana …). A mark is deliberately the
// THINNEST kind on the shelf: it publishes no facts and has no drawing, its whole
// content is the rule, and MarkView already renders that rule in the lesson's own
// words (so the reference and the walk cannot drift). This page only FRAMES it in
// the shared entry surface, opened by the one-line summary.
//
//   header
//   The rule  (accent) — the summary Lead, then MarkView (the lesson's own copy)
//
// There is no more to design here than the data supports, and that is the point:
// see the header of src/data/marks.ts and mark-view.tsx.

import { ContentEntryHeader } from "@/components/library/content-entry-header";
import { EntrySurface, Lead, Section } from "@/components/library/entry-section";
import { MarkView } from "@/components/library/mark-view";
import { markFor } from "@/data/marks";
import type { ContentItem } from "@/lib/content/item";

export function MarkEntryView({ item }: { item: ContentItem }) {
  const mark = markFor(item.entry);
  if (!mark) return null;

  return (
    <EntrySurface>
      <ContentEntryHeader item={item} />

      <Section title="The rule" tone="accent">
        {/* The one-line rule. The header's headline is empty for a mark (no
            facts, and several marks have no glyph), so this is not a repeat of
            anything above it. */}
        <Lead>{mark.summary}</Lead>
        <MarkView mark={mark} />
      </Section>
    </EntrySurface>
  );
}

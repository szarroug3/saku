"use client";

// TERM entry — the redesigned Library page for one glossary term (Counter,
// Kun'yomi and on'yomi, JLPT, Romaji …): a word the app uses before it defines
// it. A term has no glyph and no facts; its content is a definition, and for the
// fourteen terms the app already teaches a card about, TermView renders that
// card's own copy (so the glossary and the lessons cannot drift). This page only
// FRAMES it in the shared entry surface, opened by the one-line summary.
//
//   header
//   What it means  (accent) — the summary Lead, then TermView (definition/cards)
//
// A term with no card is the definition and nothing else — that is what the data
// supports, and it is not padded. See src/data/terms.ts and term-view.tsx.

import { ContentEntryHeader } from "@/components/library/content-entry-header";
import { EntrySurface, Lead, Section } from "@/components/library/entry-section";
import { TermView } from "@/components/library/term-view";
import { termFor } from "@/data/terms";
import type { ContentItem } from "@/lib/content/item";

export function TermEntryView({ item }: { item: ContentItem }) {
  const term = termFor(item.entry);
  if (!term) return null;

  return (
    <EntrySurface>
      <ContentEntryHeader item={item} />

      <Section title="What it means" tone="accent">
        {/* The one-line answer. TermView below carries the fuller definition (its
            body prose, or the lesson card when the term has one), so this frames
            rather than repeats it; the header headline is empty for a term. */}
        <Lead>{term.summary}</Lead>
        <TermView term={term} />
      </Section>
    </EntrySurface>
  );
}

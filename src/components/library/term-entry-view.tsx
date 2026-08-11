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
import { EntrySurface, Section } from "@/components/library/entry-section";
import { TermView } from "@/components/library/term-view";
import { termFor } from "@/data/terms";
import type { EntryId } from "@/types";

export function TermEntryView({ entry }: { entry: EntryId }) {
  const term = termFor(entry);
  if (!term) return null;

  return (
    <EntrySurface>
      {/* A term's NAME (Counter) is the hero and its one-line gloss the sub. */}
      <ContentEntryHeader typeLabel="term" title={term.name} sub={term.summary} />

      <Section title="What it means" tone="accent">
        <TermView term={term} />
      </Section>
    </EntrySurface>
  );
}

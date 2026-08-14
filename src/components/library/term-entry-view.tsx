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
//
// FETCHED BY ID, not imported live — the PROOF OF CONCEPT for
// docs/perf-library-list-bundle.md's deferred entry-detail work. The payload
// (name/summary/body/cards/cardMark/relatedLinks) is exactly what this page
// renders, precomputed once by scripts/seed-content-entries.mjs (calling the
// real termFor/termRow/termEntry/entryHref, `related` already resolved to
// links) and read from Supabase's `content_entries` table — see
// src/lib/library/content-entries.ts. Nothing here imports data/terms.ts.

import { ContentEntryHeader } from "@/components/library/content-entry-header";
import { EntrySurface, Section } from "@/components/library/entry-section";
import { RelatedSection } from "@/components/library/related-section";
import { TermView } from "@/components/library/term-view";
import { useContentEntry } from "@/lib/library/content-entries";
import type { PhaseIntro } from "@/data/phase-intros";
import type { EntryId } from "@/types";

interface TermPayload {
  readonly name: string;
  readonly summary: string;
  readonly body: readonly string[];
  readonly cards?: readonly PhaseIntro[];
  readonly cardMark?: string;
  readonly relatedLinks: readonly { label: string; href: string }[];
}

export function TermEntryView({ entry }: { entry: EntryId }) {
  const term = useContentEntry<TermPayload>(entry);

  // undefined = still loading, null = no such term (matches the live
  // component's `if (!term) return null` for an unresolved id).
  if (term === undefined || term === null) return null;

  return (
    <EntrySurface>
      {/* A term's NAME (Counter) is the hero, "term" the type, no headline — the
          gloss only restated the definition in the "What it means" section below. */}
      <ContentEntryHeader typeLabel="term" title={term.name} />

      <Section title="What it means" tone="accent">
        <TermView term={term} />
      </Section>

      <RelatedSection links={term.relatedLinks} />
    </EntrySurface>
  );
}

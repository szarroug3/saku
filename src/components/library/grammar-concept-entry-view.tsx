"use client";

// GRAMMAR CONCEPT entry — the redesigned Library page for a grammar IDEA rather
// than a single pattern (う-verbs vs る-verbs, い- vs な-adjectives, the keigo
// registers). A concept has NO glyph — its title IS its name, the same shape a
// term or a mark takes — so it does not wear the shared glyph header. Instead a
// name/summary header opens it, then one Section wraps the concept's body:
//
//   header               — the concept's name + one-line summary + "grammar concept"
//   The idea (accent)    — GrammarConceptView (the lesson's own concept cards)
//
// The body comes from the SAME GrammarConceptView the entry router mounts, which
// renders the lesson's own PhaseIntro cards through the lesson's IntroBody — so
// the reference page and the lesson say one set of words and cannot drift.
//
// FETCHED BY ID — name/summary/body/cards only (this page never renders
// `related`, so the seed script drops it rather than resolving it for nothing).
// GrammarConceptView is UNCHANGED — it only ever needed these fields. See
// scripts/seed-content-entries.mjs and src/lib/library/content-entries.ts.

import { ContentEntryHeader } from "@/components/library/content-entry-header";
import { EntrySurface, Section } from "@/components/library/entry-section";
import { GrammarConceptView } from "@/components/library/grammar-concept-view";
import { useContentEntry } from "@/lib/library/content-entries";
import type { PhaseIntro } from "@/data/phase-intros";
import type { EntryId } from "@/types";

interface GrammarConceptPayload {
  readonly name: string;
  readonly summary: string;
  readonly body: readonly string[];
  readonly cards: readonly PhaseIntro[];
}

export function GrammarConceptEntryView({ entry }: { entry: EntryId }) {
  const concept = useContentEntry<GrammarConceptPayload>(entry);
  if (!concept) return null;

  return (
    <EntrySurface>
      {/* A concept has no glyph, so the shared header shows its NAME as the hero.
          No headline: the one-line summary only restated the idea the section
          below teaches in full. */}
      <ContentEntryHeader typeLabel="grammar concept" title={concept.name} />

      {/* THE IDEA — the concept's cards, rendered by the SAME GrammarConceptView
          the entry router mounts. Its cards render frost by default and flat
          inside this EntrySurface (FlatSurfaceProvider), so they sit on the glass
          rather than as boxes within a box. A fuller redesign would de-card the
          body entirely and let the prose run directly under the eyebrow, but
          reusing the shared view keeps the reference and the lesson identical. */}
      <Section title="The idea">
        <GrammarConceptView concept={concept} hideTitles />
      </Section>
    </EntrySurface>
  );
}

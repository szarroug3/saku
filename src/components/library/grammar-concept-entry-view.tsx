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
// NOTES FOR WIRING (nothing is fabricated here):
//  - There is no buildItem path for a concept (ContentKind has no
//    "grammar-concept"), so a caller constructs the item by hand, e.g.
//    { entry: grammarConceptEntry("verb-classes"), kind: "grammar", glyph: "",
//      facts: [], roles: [], prereqs: [], blockedBy: [], typeLabel: "grammar concept" }.
//    This view reads the concept straight off item.entry and needs only a valid
//    entry id; it does not touch glyph/facts/roles.
//  - The て-form is NO LONGER a grammar concept — that page was removed once the
//    te-sequence FORM recipe grew its own entry carrying the full teaching (it is
//    a GrammarEntryView now, not a concept). The live concepts are verb-classes,
//    adjective-types and keigo-registers.

import { ContentEntryHeader } from "@/components/library/content-entry-header";
import { EntrySurface, Section } from "@/components/library/entry-section";
import { GrammarConceptView } from "@/components/library/grammar-concept-view";
import { grammarConceptFor } from "@/data/grammar-concepts";
import type { EntryId } from "@/types";

export function GrammarConceptEntryView({ entry }: { entry: EntryId }) {
  const concept = grammarConceptFor(entry);
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
      <Section title="The idea" tone="accent">
        <GrammarConceptView concept={concept} hideTitles />
      </Section>
    </EntrySurface>
  );
}

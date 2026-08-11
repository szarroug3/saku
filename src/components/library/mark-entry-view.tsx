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
import { EntrySurface, Section } from "@/components/library/entry-section";
import { MarkView } from "@/components/library/mark-view";
import { markFor } from "@/data/marks";
import type { EntryId } from "@/types";

export function MarkEntryView({ entry }: { entry: EntryId }) {
  const mark = markFor(entry);
  if (!mark) return null;

  return (
    <EntrySurface>
      {/* A mark's NAME (Dakuten) is the hero and its one-line rule the sub. */}
      <ContentEntryHeader typeLabel="mark" title={mark.name} sub={mark.summary} />

      <Section title="The rule" tone="accent">
        <MarkView mark={mark} />
      </Section>
    </EntrySurface>
  );
}

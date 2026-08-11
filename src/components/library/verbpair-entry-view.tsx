"use client";

// TRANSITIVITY entry — the redesigned Library page for one verb PAIR (開く/開ける).
// A pair is neither a glyph nor a single fact, so it fits none of the single-glyph
// heroes; its whole content is the two verbs shown as a unit, which VerbPairView
// already draws (and the teach walk shares, so the two cannot drift). This page's
// job is only to FRAME that unit in the shared entry surface, opened by a Lead
// that says, in plain terms, what "it happens" vs "someone does it" means for
// THIS pair — the transitive/intransitive distinction without the jargon.
//
//   header
//   It happens, or someone does it  (accent) — the plain-terms Lead + VerbPairView
//
// Reference data only, read off the pair (pairForEntry). No stroke section, no
// facts table: a pair has no drawing, and its two facts are the English cues the
// card already prints.

import { ContentEntryHeader } from "@/components/library/content-entry-header";
import { EntrySurface, Lead, Section } from "@/components/library/entry-section";
import { VerbPairView } from "@/components/library/verb-pair-view";
import { pairForEntry } from "@/data/transitivity-facts";
import type { ContentItem } from "@/lib/content/item";

export function VerbPairEntryView({ item }: { item: ContentItem }) {
  // The two verbs and the one event behind this entry's id. Null only if the id
  // names no pair the build knows — the page then renders nothing, the same
  // stance the router takes.
  const pair = pairForEntry(item.entry);
  if (!pair) return null;

  return (
    <EntrySurface>
      <ContentEntryHeader item={item} />

      <Section title="It happens, or someone does it" tone="accent">
        {/* Transitive vs intransitive said without the words — which of the two
            verbs is "it happens on its own" and which is "someone makes it
            happen", using this pair's own members and English cues. */}
        <Lead>
          One event, two verbs. Use{" "}
          <span className="font-kana text-text">{pair.happens.word}</span> (
          <span className="font-kana text-text">{pair.happens.reading}</span>) when it
          happens on its own &mdash; &ldquo;{pair.happens.en}&rdquo; &mdash; with no one
          named as making it happen. Use{" "}
          <span className="font-kana text-text">{pair.doIt.word}</span> (
          <span className="font-kana text-text">{pair.doIt.reading}</span>) when someone
          does it &mdash; &ldquo;{pair.doIt.en}&rdquo;. The English sentence always tells
          you which one to reach for.
        </Lead>
        <VerbPairView pair={pair} voiceName="" />
      </Section>
    </EntrySurface>
  );
}

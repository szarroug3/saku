"use client";

// KANA entry — the redesigned Library page for one kana, on the content model.
//
// The reference "stuff" a kana page shows — the header (glyph, reading, standing,
// sound), then the drawing, the sound analogy, the story, the proving word — is
// read off the ITEM: its reading from the mnemonic, its memory hook from
// ContentItem.mnemonic. It reuses the shared header (EntryHeader) and mnemonic
// block (MnemonicView), the same components the shipped page and the lesson walk
// render, inside the glass entry surface.

import { ConfusionSection } from "@/components/library/confusion-section";
import { ContentEntryHeader } from "@/components/library/content-entry-header";
import { MnemonicView } from "@/components/lesson/mnemonic-view";
import { HowItsWritten } from "@/components/lesson/how-its-written";
import { FlatSurfaceProvider } from "@/components/ui";
import { getMnemonic } from "@/data/mnemonics";
import type { ContentItem } from "@/lib/content/item";

export function KanaEntryView({ item }: { item: ContentItem }) {
  // The mnemonic is kana-specific reference data keyed by glyph — not a base
  // ContentItem field — so a kana view looks it up.
  const m = getMnemonic(item.glyph);
  if (!m) return null;
  // The following-sound rules and the shape lookalikes ride on the kana item
  // itself (see KanaItem). Narrow to read them; a non-kana item has neither.
  const context = item.kind === "kana" ? item.context : null;
  const confusables = item.kind === "kana" ? item.confusables : [];
  return (
    // NO CARD: the entry reads as a natural part of the page. Flat surface so the
    // shared "How it's written" section drops its own card fill.
    <FlatSurfaceProvider>
      <div>
        <ContentEntryHeader item={item} />
        <div className="mt-5 border-t border-border/50 pt-6">
          <MnemonicView m={m} glyph={item.glyph} voiceName="" />
        </div>
        {/* How its sound bends to what follows it (ん borrows the next place, っ
            doubles the next consonant), as a heads-up aside — the same left-rule
            "Heads up." treatment other pages use for a rule with a wrinkle. Only
            ん/っ carry rules; every other kana has context null and shows nothing. */}
        {context ? (
          <div className="mt-5 border-l-2 border-accent pl-3.5">
            <p className="text-[13px] leading-relaxed text-text-muted">
              <span className="font-medium text-text">Heads up. </span>
              {context.summary}
            </p>
            <div className="mt-2.5 flex flex-col gap-1.5">
              {context.rules.map((rule) => (
                <p key={rule.when} className="text-[13px] leading-relaxed text-text-muted">
                  <span className="text-text">{rule.when}</span> &rarr; said{" "}
                  <span className="font-medium text-accent">{rule.sounds}</span>
                  <span className="ml-1.5 font-kana">{rule.example}</span>
                </p>
              ))}
            </div>
          </div>
        ) : null}
        {/* Shape lookalikes, above the stroke diagram — the reference before the
            "how to draw it" that closes the page. */}
        <ConfusionSection confusables={confusables} />
        {/* Collapsed by default, like every other page: the "we don't recommend
            learning to write early" notice, Show expands the stroke diagram. */}
        <div className="mt-5 border-t border-border/50 pt-5">
          <HowItsWritten
            item={{ entry: item.entry, glyph: item.glyph, kind: "kana", facts: item.facts.map((f) => f.id) }}
          />
        </div>
      </div>
    </FlatSurfaceProvider>
  );
}

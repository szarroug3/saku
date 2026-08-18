"use client";

// KANA entry — the redesigned Library page for one kana, on the content model.
//
// The reference "stuff" a kana page shows — the header (glyph, reading, standing,
// sound), then the drawing, the sound analogy, the story, the proving word — is
// read off the ITEM: its reading from the mnemonic, its memory hook from
// ContentItem.mnemonic. It reuses the shared header (EntryHeader) and mnemonic
// block (MnemonicView), the same components the shipped page and the lesson walk
// render, inside the glass entry surface.
//
// FETCHED BY ID by default — the Library route. The only genuinely heavy
// derivation a kana page reads is itemHeadline's {text, speak} — seeded per kana
// glyph by scripts/seed-content-entries.mjs and fetched here via useContentEntry.
// Everything else is already content-free or precomputed off library-index.ts:
// the mnemonic (data/mnemonics, keyed by glyph), the following-sound context
// (data/kana-context), the shape lookalikes (kanaConfusables), and the stroke
// fallback (precomputedStrokeFallback). typeLabel is the constant "kana"
// (contentTypeLabel's default branch for this kind — no need to fetch it).
//
// The teach walk (TeachItemView) and /dev/views already build a live
// `ContentItem` for every kind they show — they have the whole dictionary
// loaded regardless of kana — so passing `item` instead of `entry` skips the
// fetch. A live-only adapter computes itemHeadline and passes it here, keeping
// that dictionary dependency out of the Library route's shared renderer.

import { ConfusionSection } from "@/components/library/confusion-section";
import { ContentEntryHeader } from "@/components/library/content-entry-header";
import { MnemonicView } from "@/components/lesson/mnemonic-view";
import { HowItsWritten } from "@/components/lesson/how-its-written";
import { FlatSurfaceProvider } from "@/components/ui";
import { getMnemonic } from "@/data/mnemonics";
import { contextPronunciation } from "@/data/kana-context";
import { useContentEntry } from "@/lib/library/content-entries";
import { libEntry, kanaConfusables, precomputedStrokeFallback } from "@/lib/library/library-index";
import type { Headline } from "@/lib/content/headline";
import type { ContentItem } from "@/lib/content/item";
import type { EntryId } from "@/types";

export function KanaEntryView({
  entry,
  item,
  liveHeadline,
}: {
  entry?: EntryId;
  item?: ContentItem;
  liveHeadline?: Headline;
}) {
  const fetched = useContentEntry<Headline>(item ? null : (entry ?? null));
  const headline = item ? liveHeadline : fetched;
  const glyph = item ? item.glyph : libEntry(entry!)?.glyph;
  const resolvedEntry = item ? item.entry : entry!;
  const strokeFallback = glyph ? precomputedStrokeFallback(glyph) : undefined;

  // undefined = still loading, null/no glyph = no such entry (matches the live
  // component's behavior for an unresolved id).
  if (headline === undefined || headline === null || !glyph || !strokeFallback) return null;

  // A derived kana (dakuten/handakuten/yōon — が, ぱ, きゃ …) has no row in
  // MNEMONICS: see that file's header, "a kana with no row here shows no
  // block." That is a rule for the ONE mnemonic block below, not license to
  // bail the whole page — the header, pronunciation context, confusables and
  // stroke-order sections are all independently correct for these glyphs, so
  // only the mnemonic div is conditional on `m`.
  const m = getMnemonic(glyph);
  const context = contextPronunciation(glyph);
  const confusables = kanaConfusables(glyph);

  return (
    // NO CARD: the entry reads as a natural part of the page — a plain, unstyled
    // <article> (semantic anchor, no fill/border). Flat surface so the shared
    // "How it's written" section drops its own card fill.
    <FlatSurfaceProvider>
      <article>
        <ContentEntryHeader glyph={glyph} headline={headline} typeLabel="kana" />
        {m ? (
          <div className="mt-5 border-t border-border/50 pt-6">
            <MnemonicView m={m} glyph={glyph} />
          </div>
        ) : null}
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
            item={{ entry: resolvedEntry, glyph, kind: "kana", facts: [] }}
            precomputedFallback={strokeFallback}
          />
        </div>
      </article>
    </FlatSurfaceProvider>
  );
}

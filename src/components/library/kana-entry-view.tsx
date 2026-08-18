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
//
// SAK-72 PART A — A DERIVED (dakuten/handakuten) KANA COMPOSES ITS PAGE FROM
// ITS BASE, RATHER THAN GOING WITHOUT
// ============================================================================
// が has no row in MNEMONICS and no pair in LOOKALIKES (both deliberately —
// they are the base-kana tables), so before this it fell through to the plain
// header + generic stroke fallback SAK-14 left behind. が is not a new shape to
// learn, though: it is か plus one predictable mark, and the app already has
// three real sources for that relationship —
//
//   dakutenRowFor(glyph)         the k→g rule, the authored hook/aside, and the
//                                 pair [か, が] (data/dakuten-rows.ts)
//   getMnemonic(baseGlyph)       か's own shape story, relabelled as reused
//   derivedKanaConfusables(glyph) か plus any other kana marked off か
//                                 (lib/library/kana-family.ts)
//
// So `row`/`base` below are computed ONCE and feed all three blocks. Every one
// of them is null/empty for a base kana (dakutenRowFor returns null), so the
// three new blocks are exactly as absent on か's own page as they were before —
// this only ADDS content on a derived kana's page.

import Link from "next/link";

import { ConfusionSection } from "@/components/library/confusion-section";
import { ContentEntryHeader } from "@/components/library/content-entry-header";
import { Section, SubLabel } from "@/components/library/entry-section";
import { Callout } from "@/components/lesson/callout";
import { MnemonicView } from "@/components/lesson/mnemonic-view";
import { HowItsWritten } from "@/components/lesson/how-its-written";
import { Pair } from "@/components/lesson/conversion-card";
import { FlatSurfaceProvider } from "@/components/ui";
import { kanaEntry } from "@/data/characters";
import { dakutenRowFor, hookRuns, type DakutenRow } from "@/data/dakuten-rows";
import { getMnemonic } from "@/data/mnemonics";
import { contextPronunciation } from "@/data/kana-context";
import { useContentEntry } from "@/lib/library/content-entries";
import { entryHref } from "@/lib/library/href";
import { derivedKanaConfusables } from "@/lib/library/kana-family";
import { libEntry, kanaConfusables, precomputedStrokeFallback } from "@/lib/library/library-index";
import { useQuizConfig } from "@/lib/quiz-config";
import type { Headline } from "@/lib/content/headline";
import type { ContentItem } from "@/lib/content/item";
import type { EntryId } from "@/types";

/** The rule + hook/aside + link-to-base block for a DERIVED kana — が's "k→g,
 * the karate kick smashes the garden gate, built from か" strip. Scoped to the
 * one glyph on this page (a single Pair, not the five-wide lesson strip), so it
 * reads as a fact about THIS character rather than a repeat of the mark's own
 * Library page. Renders nothing when `row` is null (a base kana never reaches
 * this — see the call site). */
function SoundShiftSection({ glyph, base, row }: { glyph: string; base: string; row: DakutenRow | null }) {
  const { cfg } = useQuizConfig();
  if (!row) return null;
  const runs = hookRuns(row.hook);
  return (
    <Section title="Sound shift">
      <div className="flex flex-wrap items-center gap-x-8 gap-y-4">
        <Pair base={base} converted={glyph} voiceName={cfg.voiceName} />
        <p className="flex items-center gap-2.5 text-[22px] font-light leading-none text-text">
          <span>{row.from}</span>
          <span aria-hidden className="text-[15px] text-text-muted">
            &rarr;
          </span>
          <span className="text-accent">{row.to}</span>
        </p>
      </div>
      <p className="mt-4 text-[15px] leading-relaxed text-text">
        A {row.markName} changes the sound of the consonant while the vowel stays the same.
      </p>
      {runs.length ? (
        <p className="mt-2.5 max-w-[52ch] text-[15px] leading-relaxed text-text">
          {runs.map((r, i) =>
            r.hit ? (
              <span key={i} className="font-medium text-accent">
                {r.text}
              </span>
            ) : (
              <span key={i}>{r.text}</span>
            ),
          )}
        </p>
      ) : null}
      {row.aside || row.callout ? (
        <div className="mt-3 space-y-3">
          {row.aside ? <Callout label="Note.">{row.aside}</Callout> : null}
          {row.callout ? <Callout label="Heads up.">{row.callout}</Callout> : null}
        </div>
      ) : null}
      <p className="mt-3 text-[13px] text-text-muted">
        Built from{" "}
        <Link href={entryHref(kanaEntry(base))} className="text-accent no-underline hover:underline">
          {base}
        </Link>
        .
      </p>
    </Section>
  );
}

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

  // The dakuten/handakuten row this glyph is the CONVERTED half of — null for
  // every base kana and every yōon glyph (Part B's problem, not this one's).
  // `base` is the row's own base half, read off its `pairs`, so it can never
  // name a character the row itself doesn't teach.
  const row = dakutenRowFor(glyph);
  const base = row?.pairs.find(([, converted]) => converted === glyph)?.[0];
  // No new story: when this glyph has none of its own, fall back to the BASE's
  // — か's shape hasn't changed, only the sound has — rather than authoring a
  // 51st mnemonic for a shape that already has one under a different key.
  const baseMnemonic = !m && base ? getMnemonic(base) : null;

  // Base-kana lookalikes (kanaConfusables, from the hand-curated LOOKALIKES
  // table) plus, for a derived kana, its own family — the base plus any other
  // kana marked off that same base (は/ば/ぱ). The two sources are mutually
  // exclusive today (LOOKALIKES names no derived glyph; derivedKanaConfusables
  // is empty for a base glyph), so this is a plain merge, not a fallback chain.
  const confusables = [...new Set([...kanaConfusables(glyph), ...derivedKanaConfusables(glyph)])];

  return (
    // NO CARD: the entry reads as a natural part of the page — a plain, unstyled
    // <article> (semantic anchor, no fill/border). Flat surface so the shared
    // "How it's written" section drops its own card fill.
    <FlatSurfaceProvider>
      <article>
        <ContentEntryHeader glyph={glyph} headline={headline} typeLabel="kana" />
        {/* Derived-kana only: the k→g-style rule, its hook/aside, and a link
            back to the base kana. Absent for a base kana (row is null) and for
            a yōon glyph (out of scope for this pass — dakutenRowFor only
            resolves the 50 single-codepoint dakuten/handakuten glyphs). */}
        {row && base ? <SoundShiftSection glyph={glyph} base={base} row={row} /> : null}
        {m ? (
          <div className="mt-5 border-t border-border/50 pt-6">
            <MnemonicView m={m} glyph={glyph} />
          </div>
        ) : baseMnemonic && base ? (
          // No mnemonic of its own — show the BASE's, clearly labelled as
          // reused, rather than nothing. `glyph` stays the derived kana's own
          // (see MnemonicView's own doc comment on that prop): the drawing and
          // prose are か's, but the speaker still says が.
          <div className="mt-5 border-t border-border/50 pt-6">
            <SubLabel>{base}&rsquo;s story &mdash; same shape, only the sound changes</SubLabel>
            <MnemonicView m={baseMnemonic} glyph={glyph} />
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

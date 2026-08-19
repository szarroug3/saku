"use client";

// TRANSITIVITY entry — the redesigned Library page for one verb PAIR (開く/開ける).
// A pair is two verbs for one event: one for when it happens on its OWN, one for
// when SOMEONE does it. The page shows them the same boxless way the keigo forms
// read — each side's role in accent, the "what that means" note in a tooltip,
// then the verb, its reading, a speaker, and the English sentence that points to
// it.
//
//   header
//   It happens, or someone does it  (accent) — the two verbs, keigo-style
//
// pairForEntry reads data/transitivity.ts LIVE — a small, self-contained ~27KB
// file with no dictionary dependency, so there's nothing to gain fetching a
// headline for this page at all: the header is the PAIR's own name ("出る / 出す"),
// via ContentEntryHeader's glyph-less `title` mode (the same one a grammar
// concept or term uses), not a single side's glyph and meaning.

import { ContentEntryHeader } from "@/components/library/content-entry-header";
import { EntrySurface } from "@/components/library/entry-section";
import { Info } from "@/components/ui";
import { HearButton } from "@/components/ui/hear-button";
import { pairForEntry } from "@/data/transitivity-facts";
import { hasKanji } from "@/lib/romaji";
import type { ContentItem } from "@/lib/content/item";
import type { EntryId } from "@/types";
import type { ReactNode } from "react";

/** `jp` with `[start, end)` picked out in the same accent color the sentence
 * track and the grammar entry page color a highlighted piece with
 * (.sentence-part-topic) — one visual language for "here is the piece that
 * matters" everywhere the app shows a sentence. Same treatment as
 * grammar-entry-view's `highlightSpan`, just a 2-tuple span instead of that
 * one's 3-tuple (no per-span color choice needed here — the marking particle
 * is always the thing lit). */
function highlightParticle(jp: string, span: readonly [number, number]): ReactNode {
  const [start, end] = span;
  if (start < 0 || end > jp.length || start >= end) return jp;
  return (
    <>
      {jp.slice(0, start)}
      <span className="font-medium sentence-part-topic">{jp.slice(start, end)}</span>
      {jp.slice(end)}
    </>
  );
}

export function VerbPairEntryView({
  entry,
  item,
}: {
  entry?: EntryId;
  item?: ContentItem;
}) {
  const resolvedEntry = item ? item.entry : entry!;
  const pair = pairForEntry(resolvedEntry);

  if (!pair) return null;

  const sides = [
    {
      m: pair.happens,
      label: "It happens on its own",
      help: "No one is named as making it happen; it just happens.",
    },
    {
      m: pair.doIt,
      label: "Someone does it",
      help: "Someone makes it happen.",
    },
  ];

  return (
    <EntrySurface>
      <ContentEntryHeader title={`${pair.happens.word} / ${pair.doIt.word}`} typeLabel="Verb pair" />

      {/* No section title or lead: the two accent role labels (It happens on its
          own / Someone does it) are the structure, and each carries its own
          tooltip. Just a divider under the header. */}
      <div className="mt-5 border-t border-border/50 pt-5">
        <div className="flex flex-col gap-5">
          {sides.map((s) => (
            <div key={s.m.word}>
              <p className="mb-1.5 flex items-center text-[11px] font-medium uppercase tracking-[0.06em] text-accent">
                {s.label}
                <Info>{s.help}</Info>
              </p>
              <div className="flex items-center gap-2.5">
                <HearButton glyph={s.m.reading} />
                <span className="font-kana text-[22px] leading-none text-text">{s.m.word}</span>
                {/* Furigana glosses a kanji reading — an all-kana verb has
                    nothing for it to add. See SAK-38. */}
                {hasKanji(s.m.word) ? (
                  <span className="font-kana text-[13px] text-text-muted">{s.m.reading}</span>
                ) : null}
              </div>
              <p className="mt-1.5 text-[13px] leading-relaxed text-text-muted">{s.m.en}</p>
              {s.m.example ? (
                <p lang="ja" className="mt-1 font-kana text-[15px] leading-relaxed text-text">
                  {highlightParticle(s.m.example.jp, s.m.example.particleSpan)}
                </p>
              ) : null}
            </div>
          ))}
        </div>
      </div>
    </EntrySurface>
  );
}

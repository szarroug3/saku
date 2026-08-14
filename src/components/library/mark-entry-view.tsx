"use client";

// MARK entry — the redesigned Library page for one reading rule (゛ dakuten, っ,
// long vowels, rendaku, punctuation, okurigana …). Its name is the hero, "mark"
// the type, no headline; then "The rule".
//
// A CONVERSION mark (dakuten, handakuten) uses the reorganised-by-change view
// (DakutenConversionView): the rule, then each consonant change with its mnemonic
// and the per-script strips. Every other mark keeps the plain MarkView (the
// lesson's own copy), which the reference and the walk share so they can't drift.
//
// The `set` prop is the LESSON: it narrows a conversion mark to a single script
// and drops the "in hiragana" / "in katakana" labels, so the hiragana lesson
// shows only the hiragana strips and the katakana lesson only the katakana ones —
// otherwise the same page.
//
// FETCHED BY ID — the full `Mark` object, unmodified (mirrors TermEntryView's
// approach): MarkView/DakutenConversionView are UNCHANGED, since they only ever
// needed the mark object itself, not a live import of data/marks.ts. See
// scripts/seed-content-entries.mjs and src/lib/library/content-entries.ts.

import { ContentEntryHeader } from "@/components/library/content-entry-header";
import { DakutenConversionView, isConversionMark } from "@/components/library/conversion-view";
import { EntrySurface, Section } from "@/components/library/entry-section";
import { MarkView } from "@/components/library/mark-view";
import { useContentEntry } from "@/lib/library/content-entries";
import type { Mark } from "@/data/marks";
import type { EntryId } from "@/types";

export function MarkEntryView({
  entry,
  set,
}: {
  entry: EntryId;
  /** Lesson mode: show only this script's strips, without the script labels. */
  set?: "hiragana" | "katakana";
}) {
  const mark = useContentEntry<Mark>(entry);
  if (!mark) return null;

  const conversion = isConversionMark(mark);

  return (
    <EntrySurface>
      {/* A conversion mark (゛ / ゜) leads with the mark itself as the hero and its
          name as the headline — the glyph is the thing, and its name is what you
          call it. Every other mark keeps its name as the hero (long vowels have no
          single glyph to show). "mark" is the type. */}
      {conversion ? (
        <ContentEntryHeader typeLabel="mark" title={mark.glyph} sub={mark.name} />
      ) : (
        <ContentEntryHeader typeLabel="mark" title={mark.name} />
      )}

      <Section title="The rule" tone="accent">
        {conversion ? (
          <DakutenConversionView mark={mark} set={set} />
        ) : (
          <MarkView mark={mark} />
        )}
      </Section>
    </EntrySurface>
  );
}

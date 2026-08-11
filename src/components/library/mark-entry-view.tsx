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

import { ContentEntryHeader } from "@/components/library/content-entry-header";
import { DakutenConversionView, isConversionMark } from "@/components/library/conversion-view";
import { EntrySurface, Section } from "@/components/library/entry-section";
import { MarkView } from "@/components/library/mark-view";
import { markFor } from "@/data/marks";
import type { EntryId } from "@/types";

export function MarkEntryView({
  entry,
  set,
}: {
  entry: EntryId;
  /** Lesson mode: show only this script's strips, without the script labels. */
  set?: "hiragana" | "katakana";
}) {
  const mark = markFor(entry);
  if (!mark) return null;

  return (
    <EntrySurface>
      {/* Name as hero, "mark" type, no headline — the rule is the section below. */}
      <ContentEntryHeader typeLabel="mark" title={mark.name} />

      <Section title="The rule" tone="accent">
        {isConversionMark(mark) ? (
          <DakutenConversionView mark={mark} set={set} />
        ) : (
          <MarkView mark={mark} />
        )}
      </Section>
    </EntrySurface>
  );
}

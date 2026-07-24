"use client";

// The kanji readings table: all of them, one table, full ink on every row.
//
// WHAT A READER WANTS OFF THIS TABLE
// ==================================
// Two things, and the owner named them both: how the character is said, and
// what it means when it is said that way. So every row is a reading, a word it
// is heard in, and what that word means. 入 is にゅう in 入院 (hospitalization),
// い in 入れる (to put in), はい in 手に入る (to obtain). Same character, same
// "enter" underneath, three different sounds a reader has to be able to place.
//
// WHY THERE IS NO "MEANING OF THE READING" COLUMN
// ===============================================
// Because a reading has no meaning of its own. 入 means enter whichever way it
// is pronounced, and a column repeating that on every row would just be the
// page header again, five times. The example word carries the meaning, which is
// the level at which meaning is actually true.
//
// NO DIMMING, AND THE QUIZ GATE IS UNCHANGED
// ==========================================
// Rows used to be greyed until a word you knew attested them. That made a
// reference table look like a progress bar, so the grey is gone. The RULE it
// was drawing is not: a reading fact is keyed on (kanji, word) and is only ever
// asked once you learn a word that uses it (word-unlock.ts, untouched). Reading
// the whole table today and being asked about part of it are two different
// things, and only the first one happens here.

import Link from "next/link";

import { StandingChip } from "@/components/library/standing-chip";
import { Card, Lbl, SoundIcon } from "@/components/ui";
import { readingFactId, type ReadingRow } from "@/data/kanji";
import { VOCAB_SUBJECT, vocabRow } from "@/data/vocab";
import { entryForGlyph } from "@/lib/library/entries";
import { entryHref } from "@/lib/library/href";
import { standingOf } from "@/lib/library/standing";
import type { Claims } from "@/lib/claims";
import type { AccuracyMetric, FactAggregate, HistoryFile } from "@/types";

/** A word, linked when it has a page of its own. The `?? null` case is the join
 * being honest: a word can attest a reading and still not have survived the
 * all-jōyō cut that built the vocabulary shelf. It is still the evidence, so it
 * prints as text rather than vanishing. */
function WordLink({ word }: { word: string }) {
  const id = entryForGlyph(VOCAB_SUBJECT, word);
  if (!id) return <span>{word}</span>;
  return (
    <Link href={entryHref(id)} className="text-accent no-underline">
      {word}
    </Link>
  );
}

/** What the example word means, from the vocabulary the app already ships.
 *
 * `glosses[0]` is the primary sense after the sense merge, so 人 reads as "man,
 * person" and not as the -ian suffix. A word the shelf never took returns null
 * and the cell stays empty: the word is still real evidence for the reading,
 * and printing a placeholder beside it would be noise. */
function meaningOf(word: string): string | null {
  return vocabRow(word)?.glosses[0] ?? null;
}

export function KanjiReadings({
  rows,
  anchors,
  facts,
  claims,
  metric,
  now,
  onSpeak,
}: {
  rows: readonly ReadingRow[];
  /** fact → the KNOWN word to show as its context. A reading absent from this
   * map has no word you have met behind it, so the row falls back to the
   * anchor, which is the evidence whether or not you have learned it. */
  anchors: Map<string, string>;
  facts: HistoryFile["facts"];
  claims: Claims;
  metric: AccuracyMetric;
  now: number;
  onSpeak: (text: string) => void;
}) {
  return (
    <Card>
      <Lbl>{rows.length === 1 ? "Reading" : "Readings"}</Lbl>
      <table className="w-full text-left text-[13px]">
        <thead>
          <tr className="border-b border-border text-xs font-medium text-text-muted">
            <th className="py-1.5 pr-2 font-medium">Reading</th>
            <th className="py-1.5 pr-2 font-medium">Hear</th>
            <th className="py-1.5 pr-2 font-medium">Example</th>
            <th className="py-1.5 pr-2 font-medium">Means</th>
            <th className="py-1.5 font-medium">How you&rsquo;re doing</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const fact = readingFactId(r.k, r.anchor);
            // The word you have met, when there is one, because that is the
            // example you can actually hear in your head.
            const word = anchors.get(fact) ?? r.anchor;
            const agg: FactAggregate | undefined = facts[fact];
            const s = standingOf(agg, claims[fact], metric, now);
            const means = meaningOf(word);
            return (
              <tr key={fact} className="border-b border-border last:border-b-0">
                <td className="py-2 pr-2 align-middle text-[15px]">{r.base}</td>
                <td className="py-2 pr-2 align-middle">
                  <button
                    type="button"
                    aria-label={`Hear ${r.base}`}
                    onClick={() => onSpeak(r.base)}
                    className="cursor-pointer border-none bg-transparent p-0 align-[-0.15em] text-text-muted"
                  >
                    <SoundIcon />
                  </button>
                </td>
                <td className="py-2 pr-2 align-middle">
                  <WordLink word={word} />
                  {/* The reading is voiced in some words: 口's くち is ぐち in
                      出口. Printed, because a reader who cannot see the shift
                      concludes the table is wrong. Only the anchor has a
                      surface recorded against it. */}
                  {word === r.anchor && r.surface && r.surface !== r.base ? (
                    <span className="ml-1.5 text-text-muted">({r.surface})</span>
                  ) : null}
                </td>
                <td className="py-2 pr-2 align-middle text-text-muted">{means}</td>
                <td className="py-2 align-middle">
                  <StandingChip standing={s.standing} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </Card>
  );
}

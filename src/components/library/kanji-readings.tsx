"use client";

// The kanji readings table: all of them, one table, shut rows dimmed in place.
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
// THE DIMMING, AND THE ONE LINE UNDER THE TABLE
// =============================================
// A row is greyed until a word you know attests its reading. The owner kept
// this on the Library deliberately: this page is a picture of where you stand
// with a character, and which readings you can be asked about is part of where
// you stand. Dimmed IN PLACE, not split off into a second section, because a
// shut reading is the same kind of thing as an open one and the table has to
// stay a picture of the whole character.
//
// Grey with nothing saying what grey means is a puzzle, so one sentence under
// the table says it. That is all it says. The paragraph it came from also
// explained on'yomi against kun'yomi, which went out with the From column.
//
// WHAT THE DIMMING IS AND IS NOT
// ==============================
// It is ink. The RULE it draws lives in word-unlock.ts and is untouched here: a
// reading fact is keyed on (kanji, word), so it is only ever ASKED once you
// learn a word that uses it. Reading the whole table today and being asked
// about part of it are two different things, and only the first one happens on
// this page.

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
            // example you can actually hear in your head. No word you know
            // attests the reading when this is empty, which is the shut case.
            const known = anchors.get(fact);
            const word = known ?? r.anchor;
            const agg: FactAggregate | undefined = facts[fact];
            const s = standingOf(agg, claims[fact], metric, now);
            const means = meaningOf(word);
            return (
              <tr
                key={fact}
                // Dimmed IN PLACE. Same table, same columns, less ink.
                className={`border-b border-border last:border-b-0 ${
                  known ? "" : "opacity-55"
                }`}
              >
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
      <p className="mt-2.5 text-xs text-text-muted">
        A dimmed reading opens when you learn a word that uses it.
      </p>
    </Card>
  );
}

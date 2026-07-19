"use client";

// The kanji's readings, on the lesson — ALL OF THEM, ALL OPEN.
//
// WHAT CHANGED, AND WHY IT IS THE OPPOSITE OF THE LIBRARY
// ======================================================
// This section used to be shut by default and, when opened, was a two-column
// reference apologising for itself: "you only just learned this character, so
// you can't read these yet". That was the tile-wall era's stance — the lesson
// was a summary and the Library was where the teaching lived. The redesign
// inverts it. THIS is the screen where a learner first meets 生; the Library is
// a reference most people never open. So the readings are the teaching material
// and they are on the page.
//
// The Library's `KanjiReadings` DIMS the readings no known word attests and
// prints "opens with 人生" in their place, which is exactly right there: that
// page is a picture of where you stand with a character, and a shut reading is
// part of where you stand. Here it would be wrong twice over. On the day you
// meet 生 every reading is shut, so the whole table would be dimmed — a section
// rendered entirely in 55% ink, saying nothing except that you are new. And
// "opens with X" is a progress report, which is a standing, which a lesson step
// does not show. The owner's line: "this is the kanji page that teaches it so
// all readings should be opened."
//
// So: full ink on every row, no per-row state, no chip, no link telling you what
// to learn next. What it shows instead is the four things that are true of a
// reading regardless of who is reading the page — how it sounds, where it came
// from, a word it is heard in, and how many words use it — plus a speaker,
// because a reading is a SOUND and the one thing a table of kana cannot do is
// make it audible.
//
// NO TOGGLE EITHER. The Show/Hide and its persisted preference are gone with the
// apology that used to sit behind them. A collapsed section is a bet that the
// reader does not want the material; this section IS the material, and the walk
// already has a Next button for readers who want to move on.
//
// THE ONE LINE AT THE FOOT is the honest half of what the old collapsed prompt
// said. "All open" must not be read as "all askable now" — the drill still never
// asks a reading until a word proves it (word-unlock.ts, unchanged by any of
// this) — so the foot says so in one sentence and stops.

import Link from "next/link";

import { HearButton } from "@/components/lesson/hear-button";
import { LessonPanel } from "@/components/lesson/lesson-panel";
import { VOCAB_SUBJECT } from "@/data/vocab";
import { entryForGlyph, libEntry, readingRowsOf } from "@/lib/library/entries";
import { entryHref } from "@/lib/library/href";
import type { LessonItem } from "@/lib/lesson-items";

/** A word, linked when it has a page of its own. The unlinked case is the join
 * being honest, exactly as on the Library: a word can attest a reading and still
 * not have survived the all-jōyō cut that built the vocabulary shelf. It is
 * still the evidence, so it prints as text rather than vanishing. */
function WordLink({ word }: { word: string }) {
  const id = entryForGlyph(VOCAB_SUBJECT, word);
  if (!id) return <span className="font-kana text-text">{word}</span>;
  return (
    <Link href={entryHref(id)} className="font-kana text-accent no-underline">
      {word}
    </Link>
  );
}

export function LessonReadings({
  item,
  voiceName,
}: {
  item: LessonItem;
  voiceName: string;
}) {
  const entry = libEntry(item.entry);
  if (!entry) return null;
  const rows = readingRowsOf(entry);
  // ABSENT, not empty — 114 of the jōyō kanji have no reading rows at all, and a
  // headed box over a header row and nothing else reads as data that failed to
  // load.
  if (!rows.length) return null;

  return (
    <LessonPanel title={rows.length === 1 ? "Reading" : "Readings"}>
      <div className="-mx-1 overflow-x-auto px-1">
        <table className="w-full text-left text-[13px]">
          <thead>
            <tr className="border-b border-border text-[11px] font-medium text-text-muted">
              <th className="py-1.5 pr-2 font-medium">Reading</th>
              <th className="py-1.5 pr-2 font-medium">From</th>
              <th className="py-1.5 pr-2 font-medium">Heard in</th>
              <th className="py-1.5 font-medium">Used in</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr
                key={`${r.k}/${r.anchor}`}
                className="border-b border-border last:border-b-0"
              >
                <td className="py-2 pr-2 align-middle">
                  {/* The speaker sits WITH the thing it speaks, to its left, the
                      same rule the forms table and the entry header follow. */}
                  <span className="flex items-center gap-2">
                    <HearButton glyph={r.base} voiceName={voiceName} />
                    <span className="font-kana text-[15px]">{r.base}</span>
                  </span>
                </td>
                {/* CHINESE / JAPANESE, never on'yomi / kun'yomi. Those name the
                    thing for someone who already knows it. */}
                <td className="py-2 pr-2 align-middle text-text-muted">
                  {r.type === "on"
                    ? "Chinese"
                    : r.type === "kun"
                      ? "Japanese"
                      : r.type === "both"
                        ? "both"
                        : "—"}
                </td>
                {/* THE WORD, unconditionally — not "the word you know", which is
                    what the Library shows and what would leave every cell on
                    this page empty on the day the character is met. The anchor
                    is the evidence-richest word attesting the reading, and it is
                    the evidence whether or not you have learned it yet. */}
                <td className="py-2 pr-2 align-middle">
                  <WordLink word={r.anchor} />
                  {/* The surface differs from the base when the reading is
                      voiced in this word — 口's くち is ぐち in 出口. Printed,
                      because a reader who cannot see the shift concludes the
                      table is wrong. */}
                  {r.surface && r.surface !== r.base ? (
                    <span className="ml-1.5 font-kana text-text-muted">
                      ({r.surface})
                    </span>
                  ) : null}
                </td>
                <td className="py-2 align-middle text-text-muted">
                  {r.nWords} {r.nWords === 1 ? "word" : "words"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-auto pt-2.5 text-[11px] leading-relaxed text-text-muted/80">
        A reading is only ever asked INSIDE a word, once you learn a word that
        uses it. Nothing here is asked today.
      </p>
    </LessonPanel>
  );
}

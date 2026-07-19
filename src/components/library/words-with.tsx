"use client";

// "Words with this character" — the payoff section of a kanji page.
//
// ORDERED BY TEACHING ORDER, NOT BY RAW FREQUENCY. `beginnerRank` — word-lesson.ts
// calls it the teaching order outright: "1 is the first word a beginner meets".
// For 生 that is 先生 (74), 生まれる (125), 生徒 (156), 学生 (187), 誕生日 (270),
// 生きる (590). A frequency sort puts 人生 and 一生 near the top; both are much
// later in the curriculum, so the list would be showing you words to look
// forward to instead of the ones you are about to meet.
//
// CAPPED AT 8, WITH THE TRUE TOTAL ON THE BUTTON. Readings never need a filter
// and words always do: 人 appears in 142 words, 大 in 113, 一 in 101. The cap is
// the opposite decision from the readings table above it, and both follow from
// the same measurement rather than from a house style.

import Link from "next/link";
import { useState } from "react";

import { StandingChip } from "@/components/library/standing-chip";
import { Card, Lbl } from "@/components/ui";
import { VOCAB_SUBJECT, vocabRow, wordMeaningFactId } from "@/data/vocab";
import { entryForGlyph } from "@/lib/library/entries";
import { entryHref } from "@/lib/library/href";
import { standingOf } from "@/lib/library/standing";
import type { Claims } from "@/lib/claims";
import type { AccuracyMetric, HistoryFile } from "@/types";

const VISIBLE = 8;

export function WordsWith({
  words,
  label = "Words with this character",
  facts,
  claims,
  metric,
  now,
}: {
  /** Every everyday word written with this character, in vocab order. */
  words: readonly string[];
  /**
   * The heading. A prop and not a constant because the component page passes a
   * DIFFERENT LIST with the same rows: "words you know that use it", which is
   * the user's own vocabulary filtered through a shape rather than every word
   * containing a character. The rows — link, reading, gloss, standing dot — are
   * identical, and reimplementing them beside a different heading is how two
   * lists start disagreeing about what a standing dot means.
   */
  label?: string;
  facts: HistoryFile["facts"];
  claims: Claims;
  metric: AccuracyMetric;
  now: number;
}) {
  const [showAll, setShowAll] = useState(false);

  const ordered = [...words].sort(
    (a, b) =>
      (vocabRow(a)?.beginnerRank ?? Infinity) - (vocabRow(b)?.beginnerRank ?? Infinity),
  );
  const shown = showAll ? ordered : ordered.slice(0, VISIBLE);

  return (
    <Card>
      <Lbl>{label}</Lbl>
      <div className="flex flex-col gap-1.5">
        {shown.map((w) => {
          const id = entryForGlyph(VOCAB_SUBJECT, w);
          const row = vocabRow(w);
          // A STANDING DOT, not the word's score copied here. The word is its
          // own entry with its own page; this row is a pointer to it.
          const s = standingOf(
            facts[wordMeaningFactId(w)],
            claims[wordMeaningFactId(w)],
            metric,
            now,
          );
          return (
            <div key={w} className="flex flex-wrap items-baseline gap-2 text-[13px]">
              {id ? (
                <Link href={entryHref(id)} className="text-[16px] text-text no-underline">
                  {w}
                </Link>
              ) : (
                <span className="text-[16px]">{w}</span>
              )}
              <span className="text-text-muted">{row?.reb}</span>
              <span className="min-w-0 flex-1 truncate text-text-muted">
                {row?.glosses.slice(0, 2).join(", ")}
              </span>
              <StandingChip standing={s.standing} />
            </div>
          );
        })}
      </div>
      {ordered.length > VISIBLE ? (
        <button
          type="button"
          onClick={() => setShowAll(!showAll)}
          className="mt-2.5 cursor-pointer border-none bg-transparent p-0 text-xs text-text-muted underline"
        >
          {showAll
            ? "Show fewer"
            : /* THE TRUE TOTAL, not "+8 more". 人 is in 142 words and the number
                 is the interesting part — it is the argument for learning the
                 character at all. */
              `Show all ${ordered.length} words`}
        </button>
      ) : null}
    </Card>
  );
}

"use client";

// The kanji readings table — ALL of them, one table, shut rows dimmed in place.
//
// WHY SHUT ROWS STAY IN THE TABLE
// ===============================
// Splitting them into a second section would say they are a different kind of
// thing. They are not: they are the same character's readings, and the reason
// three of them are shut is not that they are harder or rarer but that you have
// not yet met a word that uses them. Dimmed in place, the table stays a picture
// of the whole character — which is the one thing this page exists to show.
//
// THE UNLOCK MODEL, because it is genuinely confusing and the owner asked
// ==================================================================
// A kanji is NOT the lock. Learn 生 and its MEANING is askable immediately. Its
// READINGS open one at a time, because a reading fact is keyed on (kanji, word)
// — `kanji:生/reading@人生`, not `kanji:生/reading`. "What is 生 read as" has
// eight answers and cannot be graded; "what is 生 read as in 人生" has one and
// can. So a reading opens when you learn A WORD THAT USES IT, and you can know
// 生 cold with three readings still shut. Different locks.
//
// That is why a shut row NAMES THE WORD THAT WOULD OPEN IT. "Not seen" alone
// would be a dead end; the word is the actionable half, and it is a link.

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

/** The earliest word by TEACHING ORDER that would open this reading.
 *
 * `beginnerRank`, not raw frequency and not the ingest's anchor: the question a
 * shut row answers is "what do I learn next to open this", and the honest answer
 * is the one the curriculum will reach first. */
function openingWord(row: ReadingRow): string | null {
  let best: string | null = null;
  let bestRank = Infinity;
  for (const w of row.words) {
    const rank = vocabRow(w)?.beginnerRank;
    if (rank !== undefined && rank < bestRank) {
      bestRank = rank;
      best = w;
    }
  }
  return best;
}

export function KanjiReadings({
  glyph,
  rows,
  anchors,
  facts,
  claims,
  metric,
  now,
  onSpeak,
}: {
  glyph: string;
  rows: readonly ReadingRow[];
  /** fact → the KNOWN word to show as its context. A reading absent from this
   * map is shut: no word you know attests it. See word-unlock.ts. */
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
            <th className="py-1.5 pr-2 font-medium">From</th>
            <th className="py-1.5 pr-2 font-medium">Hear</th>
            <th className="py-1.5 pr-2 font-medium">Learned in</th>
            <th className="py-1.5 pr-2 font-medium">Used in</th>
            <th className="py-1.5 font-medium">How you&rsquo;re doing</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const fact = readingFactId(r.k, r.anchor);
            const known = anchors.get(fact);
            const opens = known ? null : openingWord(r);
            const agg: FactAggregate | undefined = facts[fact];
            const s = standingOf(agg, claims[fact], metric, now);
            return (
              <tr
                key={fact}
                // Dimmed IN PLACE. Same table, same columns, less ink.
                className={`border-b border-border last:border-b-0 ${
                  known ? "" : "opacity-55"
                }`}
              >
                <td className="py-2 pr-2 align-middle text-[15px]">{r.base}</td>
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
                  {known ? (
                    <WordLink word={known} />
                  ) : opens ? (
                    <span className="text-text-muted">
                      opens with <WordLink word={opens} />
                    </span>
                  ) : (
                    // No everyday word attests it. Here to be READ, never asked.
                    <span className="text-text-muted">no everyday word yet</span>
                  )}
                </td>
                {/* A REAL NUMBER, in its own column. It was a bare bar with no
                    legend stacked above the standing chip, and the two read as
                    one thing. */}
                <td className="py-2 pr-2 align-middle text-text-muted">
                  {r.nWords} {r.nWords === 1 ? "word" : "words"}
                </td>
                <td className="py-2 align-middle">
                  <StandingChip standing={s.standing} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="mt-2.5 text-xs text-text-muted">
        Readings <b className="text-text">from Chinese</b> came in with the
        character and turn up mostly inside longer words;{" "}
        <b className="text-text">Japanese</b> ones are the Japanese word{" "}
        {glyph} was given to, usually on its own. A dimmed reading opens when you
        learn a word that uses it.
      </p>
    </Card>
  );
}

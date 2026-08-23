"use client";

// "Words known through this component" — the payoff section of a primitive page.
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

import { PitchReading } from "@/components/library/pitch-mark";
import { Card, Lbl } from "@/components/ui";
import { HearButton } from "@/components/ui/hear-button";
import { wordPitch } from "@/data/pitch";
import { resolveWordLinksByGlyph } from "@/lib/library/server-lookups";
import { useServerLookup } from "@/lib/library/use-server-lookup";
import { wordBeginnerRank } from "@/lib/word-rank";

const VISIBLE = 8;

export function WordsWith({
  words,
  label = "Words with this character",
}: {
  /** Every everyday word written with this character, in vocab order. */
  words: readonly string[];
  /**
   * The heading. A prop and not a constant because the component page passes a
   * DIFFERENT LIST with the same rows: "words you know that use it", which is
   * the user's own vocabulary filtered through a shape rather than every word
   * containing a character. The rows — link, reading, gloss — are identical, and
   * reimplementing them beside a different heading is how two lists drift apart.
   */
  label?: string;
}) {
  const [showAll, setShowAll] = useState(false);

  const ordered = [...words].sort(
    (a, b) =>
      (wordBeginnerRank(a) ?? Infinity) - (wordBeginnerRank(b) ?? Infinity),
  );
  const shown = showAll ? ordered : ordered.slice(0, VISIBLE);

  // SAK-104: entryForGlyph/libEntry/pitchReadingCompatible/entryHref all read
  // server-only modules now, so the whole per-word row (id, href, reading,
  // pitch-compatibility, glosses) comes from one batched round trip keyed by
  // `shown` — the same VISIBLE-capped list already renders, so this never
  // fetches more than the page is about to show.
  const links = useServerLookup(resolveWordLinksByGlyph, [shown]);

  return (
    <Card>
      <Lbl>{label}</Lbl>
      <div className="flex flex-col gap-1.5">
        {shown.map((w) => {
          const row = links?.[w];
          // The same pitch overline the word's own entry draws, on its reading
          // here — display only, and only where a pitch is verified; a word with
          // none shows the plain reading, unchanged. See pitch-mark.tsx.
          const pitch = wordPitch(w);
          const showPitch = row?.reading != null && pitch != null && row.pitchCompatible;
          return (
            <div key={w} className="flex flex-wrap items-baseline gap-2 text-[13px]">
              {row ? (
                <Link href={row.href} className="text-[16px] text-text no-underline">
                  {w}
                </Link>
              ) : (
                <span className="text-[16px]">{w}</span>
              )}
              {showPitch ? (
                <span className="flex items-center gap-1">
                  {/* EXACT PITCH mode (SAK-100/SAK-170): same verified-downstep
                      pattern as the word's own entry (character-entry-view.tsx)
                      — this list used to draw the pitch line with no audio
                      behind it at all. */}
                  <HearButton glyph={row!.reading!} downstep={pitch!} />
                  <PitchReading
                    reading={row!.reading!}
                    downstep={pitch!}
                    className="text-text-muted"
                  />
                </span>
              ) : (
                <span className="text-text-muted">{row?.reading}</span>
              )}
              <span className="min-w-0 flex-1 truncate text-text-muted">
                {row?.meanings.slice(0, 2).join(", ")}
              </span>
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

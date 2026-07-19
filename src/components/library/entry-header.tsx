"use client";

// The header every entry page wears, whatever kind it is.
//
// ONE SHAPE FOR THREE KINDS, and that is the point: glyph on the left, what it
// MEANS in the middle, how you're doing on the right, and the SOUND underneath
// the standing. A reader who has learned where the score lives on a kana page
// does not have to learn it again on a kanji page.
//
// THE SPEAKER SITS WITH WHAT IT SPEAKS. It goes to the LEFT of the reading, not
// off on its own, because a button floating beside a row of chips says nothing
// about which of them it will pronounce. Beneath the chips rather than beside
// them for the same reason: the reading is a different kind of thing from a
// standing, and putting them on one line makes the sound look like another
// score.

import type { ReactNode } from "react";

import { PageTitle, SoundIcon } from "@/components/ui";

export function EntryHeader({
  glyph,
  title,
  sub,
  chips,
  sound,
  onSpeak,
}: {
  /** Empty for an entry with no character to show — the long-vowel rule. The
   * slot is then dropped rather than filled with the entry's NAME at 76px, which
   * would say "learn this shape" about the one entry that has none. */
  glyph: string;
  title: string;
  /** The provenance line — "Hiragana · Vowels", "Jōyō grade 1 · 5 strokes". */
  sub?: string;
  /** Standing chips, in a row. Built by the caller because what an entry is
   * allowed to claim about itself differs per kind — see standing.ts, which
   * refuses to average a kanji's facts into one adjective. */
  chips?: ReactNode;
  /** The reading to print under the chips, with a speaker to its left. Null
   * wherever there is nothing to say: a grammar pattern is a shape rather than a
   * sound, and a diacritic has no pronunciation at all. */
  sound?: { readonly text: string; readonly speak: string } | null;
  onSpeak?: (text: string) => void;
}) {
  return (
    <div className="flex flex-wrap items-start gap-5">
      {glyph ? (
        <div className="flex-none text-[76px] leading-none">{glyph}</div>
      ) : null}

      <div className="min-w-0 flex-1">
        <PageTitle title={title} />
        {sub ? <p className="mb-3 text-[13px] text-text-muted">{sub}</p> : null}
      </div>

      {/* The right-hand stack: chips in a row, sound beneath them. `items-end`
          keeps both flush to the page edge so the chips and the reading share a
          right margin rather than drifting apart at different widths. */}
      {chips || sound ? (
        <div className="flex flex-none flex-col items-end gap-1.5">
          {chips ? (
            <div className="flex flex-wrap items-center justify-end gap-1.5">{chips}</div>
          ) : null}
          {sound ? (
            <p className="m-0 flex items-center gap-1.5 text-[13px] text-text-muted">
              <button
                type="button"
                aria-label={`Hear ${sound.speak}`}
                onClick={() => onSpeak?.(sound.speak)}
                className="cursor-pointer border-none bg-transparent p-0 align-[-0.15em] text-text-muted"
              >
                <SoundIcon />
              </button>
              <span>{sound.text}</span>
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

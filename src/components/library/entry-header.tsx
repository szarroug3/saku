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
  glyphClass,
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
  /**
   * Overrides the 76px glyph size. For a KIND WHOSE "GLYPH" IS NOT ONE
   * CHARACTER — a grammar pattern is 〜なければならない, nine of them — and at
   * 76px that is a title bar and a half, wrapping over three lines and pushing
   * the gloss and the chips off the fold.
   *
   * A prop rather than a `kind` test inside this component, because the
   * component's whole point is that it does not know what it is showing: the
   * caller knows its material is long, and it is the caller that has to say so.
   */
  glyphClass?: string;
  title: string;
  /** The line under the title — "Hiragana · Vowels", "5 strokes". */
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
        <div className={glyphClass ?? "flex-none text-[76px] leading-none"}>{glyph}</div>
      ) : null}

      {/* A FLOOR, NOT `min-w-0`, and it is a bug fix rather than a preference.
          The row wraps, the chip stack is `flex-none`, and the middle column
          used to be allowed to shrink to nothing — so instead of the chips
          wrapping to their own line when they got wide, the TITLE collapsed.
          〜すぎる carries four chips (a meaning and one production rule per
          host) and its gloss came out as "do X / too / much / too / X", five
          words on five lines, with the sub-line a ribbon beside it. A minimum
          width means the chips are the thing that gives, which is the right way
          round: a chip row reads fine on its own line and a title does not read
          at all in a 60px column. */}
      <div className="min-w-[16rem] flex-1">
        <PageTitle title={title} />
        {sub ? <p className="mb-3 text-[13px] text-text-muted">{sub}</p> : null}
      </div>

      {/* The right-hand stack: chips in a row, sound beneath them. `items-end`
          keeps both flush to the page edge so the chips and the reading share a
          right margin rather than drifting apart at different widths, and
          `ml-auto` keeps them there after they have wrapped onto a line of
          their own — without it a wrapped stack sizes to its content and lands
          on the LEFT, under the glyph.

          NOT `flex-none`, which it was. A stack that cannot shrink sizes to its
          content and then overflows the card, and its own inner `flex-wrap` can
          never fire because it is never squeezed: 〜すぎる's fourth chip ran
          straight off the right edge on a narrow window. Allowed to shrink, the
          chip row wraps two-deep instead, which is what the wrap was for. */}
      {chips || sound ? (
        <div className="ml-auto flex min-w-0 flex-col items-end gap-1.5">
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

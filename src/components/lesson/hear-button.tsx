"use client";

// The speaker. Pronounceable surfaces only — a kana or a word has one sound; a
// bare kanji meaning and a grammar pattern do not.
//
// Lifted out of lesson-item-view.tsx when the conversion card arrived: that card
// puts a speaker under every converted kana, because the whole claim it makes
// is about a SOUND ("voice the k and it becomes g") and reading "ga" off a page
// does not teach anyone what voicing is. Two screens, one control.

import { SoundIcon } from "@/components/ui";
import { speak } from "@/lib/speech";

export function HearButton({
  glyph,
  voiceName,
  className = "",
}: {
  glyph: string;
  voiceName: string;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={() => speak(glyph, voiceName)}
      aria-label={`Hear ${glyph}`}
      className={`inline-flex cursor-pointer items-center justify-center rounded-md border border-border bg-card px-2 py-0.5 text-[12px] leading-none text-text-muted hover:bg-panel hover:text-text ${className}`}
    >
      <SoundIcon className="size-[14px]" />
    </button>
  );
}

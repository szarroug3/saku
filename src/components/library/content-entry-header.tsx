"use client";

// The ONE Library/Learn entry header, for any content type. The owner's layout:
//
//   glyph   [🔊] headline
//   glyph   type
//
// A big glyph on the left; to its right the headline (the main thing about the
// item — a spoken reading, or a meaning/rule) with a sound button ONLY when the
// item has one unambiguous pronunciation, and the type beneath. Everything is
// read off the item via `itemHeadline`, so every type gets the same header.
//
// `chips` is the optional standing/accuracy stack (history data the page passes
// in, not on the item); it sits at the right edge when present.

import type { ReactNode } from "react";

import { SoundIcon } from "@/components/ui";
import { itemHeadline } from "@/lib/content/headline";
import { japaneseFontClass } from "@/lib/japanese-text";
import { speak } from "@/lib/speech";
import type { ContentItem } from "@/lib/content/item";

/** Glyph size by length — a lone kanji is the title, a long pattern / Latin tier
 * label scales down so it stays one line's worth rather than a banner. */
function glyphSize(glyph: string): string {
  if (/\s/.test(glyph)) return "text-[24px]"; // a Latin phrase (a sentence tier)
  const n = [...glyph].length;
  if (n <= 1) return "text-[72px]";
  if (n <= 2) return "text-[52px]";
  if (n <= 3) return "text-[40px]";
  if (n <= 5) return "text-[30px]";
  return "text-[24px]";
}

export function ContentEntryHeader({ item, chips }: { item: ContentItem; chips?: ReactNode }) {
  const { text, speak: speakGlyph } = itemHeadline(item);
  return (
    <div className="flex items-start gap-4">
      <div className={`${japaneseFontClass(item.glyph)} ${glyphSize(item.glyph)} flex-none font-light leading-none text-text`}>
        {item.glyph}
      </div>

      <div className="min-w-0 flex-1 pt-1">
        <div className="flex items-baseline gap-2 text-[18px] leading-snug text-text">
          {speakGlyph ? (
            <button
              type="button"
              onClick={() => speak(speakGlyph, "")}
              aria-label={`Hear ${speakGlyph}`}
              className="flex-none cursor-pointer border-none bg-transparent p-0 text-accent"
            >
              <SoundIcon className="align-[-0.1em]" />
            </button>
          ) : null}
          <span className="[overflow-wrap:anywhere]">{text}</span>
        </div>
        <div className="mt-1.5 text-[11px] font-medium uppercase tracking-[0.06em] text-accent">
          {item.typeLabel}
        </div>
      </div>

      {chips ? <div className="ml-auto flex flex-none items-center gap-1.5">{chips}</div> : null}
    </div>
  );
}

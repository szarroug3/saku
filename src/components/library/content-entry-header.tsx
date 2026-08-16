"use client";

// The ONE Library/Learn entry header, for any content type. The owner's layout:
//
//   glyph   [🔊] headline
//   glyph   type
//
// A big glyph on the left; to its right the headline (the main thing about the
// item — a spoken reading, or a meaning/rule) with a sound button ONLY when the
// item has one unambiguous pronunciation, and the type beneath. Everything is
// passed as a resolved headline, so every type gets the same header without
// coupling this renderer to the dictionary-backed derivation.
//
// `chips` is the optional standing/accuracy stack (history data the page passes
// in, not on the item); it sits at the right edge when present.

import type { ReactNode } from "react";

import { HearButton } from "@/components/ui/hear-button";
import type { Headline } from "@/lib/content/headline";
import { japaneseFontClass } from "@/lib/japanese-text";
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

export function ContentEntryHeader({
  item,
  chips,
  title,
  sub,
  typeLabel,
  glyph,
  headline,
}: {
  item?: ContentItem;
  chips?: ReactNode;
  /** GLYPH-LESS items — a grammar concept, a term, a mark — are ideas, not
   * symbols, so their NAME is the hero (with the type above and a one-line
   * summary below) rather than a big glyph. Pass `title`/`sub`/`typeLabel` and no
   * `item`; the shared header owns this shape so each glyph-less page doesn't
   * hand-roll its own. */
  title?: string;
  sub?: string;
  typeLabel?: string;
  /** GLYPH-BEARING but fetched-by-id callers (kana): the live `item` isn't
   * available client-side (building one drags in the heavy dictionary), so pass
   * the glyph and `headline`/`typeLabel` — itemHeadline's precomputed output —
   * directly instead. Renders identically to the `item` path. */
  glyph?: string;
  headline?: Headline;
}) {
  // Glyph-less: the NAME takes the glyph's place as the hero, so the header reads
  // the same shape as every other entry (hero on the left, type beneath) — just
  // with a word where a glyph would be. `sub` is the optional headline line; a
  // mark passes none ("no headline"), a concept/term passes its summary.
  if (title) {
    const titlePhrase = /\s/.test(title);
    return (
      <div className="flex items-center gap-4">
        <div
          className={`${japaneseFontClass(title)} ${glyphSize(title)} flex-none font-light leading-none text-text ${
            titlePhrase ? "text-balance" : ""
          }`}
        >
          {title}
        </div>
        <div className="min-w-0 flex-1">
          {sub ? (
            <div className="text-[16px] leading-snug text-text [overflow-wrap:anywhere]">{sub}</div>
          ) : null}
          {typeLabel ? (
            <div
              className={`text-[11px] font-medium uppercase tracking-[0.06em] text-accent ${sub ? "mt-1.5" : ""}`}
            >
              {typeLabel}
            </div>
          ) : null}
        </div>
        {chips ? <div className="ml-auto flex flex-none items-center gap-1.5">{chips}</div> : null}
      </div>
    );
  }

  if (!item && !glyph) return null;
  const g = item ? item.glyph : glyph!;
  if (!headline) return null;
  const { text, speak: speakGlyph } = headline;
  const label = item ? item.typeLabel : typeLabel!;
  const phrase = /\s/.test(g);
  return (
    // Center the right column against the glyph — a tall kanji and a short kana
    // both read balanced, without the empty gap that bottom-aligning a short
    // glyph would leave.
    <div className="flex items-center gap-4">
      <div
        className={`${japaneseFontClass(g)} ${glyphSize(g)} flex-none font-light leading-none text-text ${
          phrase ? "max-w-[7.5rem] text-balance" : ""
        }`}
      >
        {g}
      </div>

      <div className="min-w-0 flex-1">
        {text ? (
          <div className="flex items-center gap-2 text-[16px] leading-snug text-text">
            {speakGlyph ? (
              <HearButton glyph={speakGlyph} />
            ) : null}
            <span className="[overflow-wrap:anywhere]">{text}</span>
          </div>
        ) : null}
        <div
          className={`text-[11px] font-medium uppercase tracking-[0.06em] text-accent ${text ? "mt-1.5" : ""}`}
        >
          {label}
        </div>
      </div>

      {chips ? <div className="ml-auto flex flex-none items-center gap-1.5">{chips}</div> : null}
    </div>
  );
}

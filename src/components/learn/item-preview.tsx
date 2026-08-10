// ItemPreview — the Learn-page card for the NEXT lesson. A teaser, not the lesson:
// it shows the glyph and its TYPE (a character's roles "radical · kanji · word",
// or "word" / "counter" / a rule) — but NOT the pronunciation or meaning, which
// are learned by entering the lesson.
//
// The card is a FIXED size; the glyph scales down so a multi-character word (先生)
// or a long kana form (ひとつ) fits without growing the box.

import { frostSurface } from "@/components/ui/frost";
import type { ContentItem } from "@/lib/content/item";

/** Glyph size so the box stays one size and the content fits. A multi-word title
 * (a sentence-ordering tier, "Simple sentences") is Latin text that wraps at
 * spaces, so it is sized by length; a CJK glyph is sized by character count. */
function glyphSize(glyph: string): string {
  const n = [...glyph].length;
  if (/\s/.test(glyph)) {
    // Multi-word title — size down so whole words fit the box, no mid-word breaks.
    if (n <= 12) return "text-[15px]";
    if (n <= 20) return "text-[12px]";
    return "text-[11px]";
  }
  if (n <= 1) return "text-[34px]";
  if (n === 2) return "text-[26px]";
  if (n === 3) return "text-[20px]";
  return "text-[16px]";
}

export function ItemPreview({ item }: { item: ContentItem }) {
  return (
    <div className={`${frostSurface} flex h-[104px] flex-col overflow-hidden p-3`}>
      {/* Glyph centered in the flexible area — same vertical position on every card. */}
      <div className="flex flex-1 items-center justify-center">
        <span
          className={`font-kana text-balance px-0.5 text-center leading-tight text-text [overflow-wrap:break-word] ${glyphSize(item.glyph)}`}
          lang="ja"
        >
          {item.glyph}
        </span>
      </div>
      {/* Type label in a fixed band, top-aligned — so a 2-line label (人) lines up
          with a 1-line one (三) across cards. */}
      <div className="flex h-7 items-start justify-center text-center">
        <span className="text-[9px] uppercase leading-tight tracking-[0.05em] text-accent">
          {item.typeLabel}
        </span>
      </div>
    </div>
  );
}

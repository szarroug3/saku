// ItemPreview — the Learn-page card for the NEXT lesson. A teaser, not the lesson:
// it shows the glyph and its TYPE (a character's roles "radical · kanji · word",
// or "word" / "counter" / a rule) — but NOT the pronunciation or meaning, which
// are learned by entering the lesson.
//
// The card is a FIXED size; the glyph scales down so a multi-character word (先生)
// or a long kana form (ひとつ) fits without growing the box.

import { frostCard } from "@/components/ui/frost";
import type { ContentItem } from "@/lib/content/item";

/** The type shown on the preview: a character shows the roles it plays; other
 * kinds show what they are. */
function typeLabel(item: ContentItem): string {
  if (item.kind === "character") return item.roles.join(" · ");
  if (item.kind === "generative-rule") return "counting rule";
  return item.kind; // word · counter · kana
}

/** Glyph size by character count, so the box stays one size and the content fits. */
function glyphSize(glyph: string): string {
  const n = [...glyph].length;
  if (n <= 1) return "text-[52px]";
  if (n === 2) return "text-[38px]";
  if (n === 3) return "text-[28px]";
  return "text-[22px]";
}

export function ItemPreview({ item }: { item: ContentItem }) {
  return (
    <div
      className={`${frostCard} flex h-[150px] flex-col items-center justify-center gap-2 overflow-hidden text-center`}
    >
      <div className={`font-kana leading-none text-text ${glyphSize(item.glyph)}`} lang="ja">
        {item.glyph}
      </div>
      <div className="text-[11px] uppercase leading-tight tracking-[0.06em] text-accent">
        {typeLabel(item)}
      </div>
    </div>
  );
}

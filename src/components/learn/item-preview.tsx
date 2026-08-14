// ItemPreview — the Learn-page card for the NEXT lesson. A teaser, not the lesson:
// it shows the glyph and its TYPE (a character's roles "radical · kanji · word",
// or "word" / "counter" / a rule) — but NOT the pronunciation or meaning, which
// are learned by entering the lesson.
//
// The card is a FIXED compact size; the glyph scales down so a multi-character
// word (先生) or a long kana form (ひとつ) fits without growing the box.
//
// LOOK: a glass card — a translucent ground so the warm page shows through, a
// soft drop shadow for lift, a top-left sheen (a radial gradient, NOT a blur, so
// no paint cost), and an oversized ghost of the glyph bleeding off the corner as
// faint texture. The type label is the app accent.

import type { CSSProperties } from "react";

import type { PreviewItem } from "@/lib/content/preview-item";

const CJK = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]/u;

/** The ghost-watermark char: the first Japanese glyph in the item, SKIPPING a
 * leading 〜 or other mark (so 〜たい → た), or 文 ("writing / sentence") for a
 * building-sentences tier whose label is Latin. Null when there's nothing to show. */
function watermarkChar(item: PreviewItem): string | null {
  for (const c of item.glyph) if (CJK.test(c)) return c;
  if (item.kind === "sentence-ordering") return "文";
  return null;
}

/** Glyph size so the box stays one size and the content fits. A multi-word title
 * (a sentence-ordering tier, "Simple sentences") is Latin text that wraps at
 * spaces, so it is sized by length; a CJK glyph is sized by character count. */
function glyphSize(glyph: string): string {
  const n = [...glyph].length;
  if (/\s/.test(glyph)) {
    if (n <= 12) return "text-[15px]";
    if (n <= 20) return "text-[12px]";
    return "text-[11px]";
  }
  if (n <= 1) return "text-[34px]";
  if (n === 2) return "text-[26px]";
  if (n === 3) return "text-[20px]";
  return "text-[16px]";
}

export function ItemPreview({ item }: { item: PreviewItem }) {
  const ghost = watermarkChar(item);
  return (
    <div
      className="relative flex h-[104px] w-[104px] shrink-0 flex-col overflow-hidden rounded-2xl border border-white/10 p-3"
      style={
        {
          backgroundColor: "color-mix(in srgb, var(--card) 42%, transparent)",
        } as CSSProperties
      }
    >
      {/* An oversized ghost of the glyph, bleeding off the corner as faint texture. */}
      {ghost && (
        <span
          className="pointer-events-none absolute -bottom-5 -right-3 select-none font-kana text-[104px] leading-none text-[color:color-mix(in_srgb,var(--text)_4%,transparent)]"
          lang="ja"
          aria-hidden
        >
          {ghost}
        </span>
      )}
      {/* Top-left sheen (a gradient, not a blur) so it reads as glass, not a box. */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{ background: "radial-gradient(130px 90px at 22% 0%, rgba(255,255,255,0.07), transparent)" }}
      />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-white/10" />

      {/* Glyph + type label as one group, centered in the tile — so the pair sits
          in the middle rather than the glyph riding high with the label low. */}
      <div className="relative flex flex-1 flex-col items-center justify-center gap-1.5 text-center">
        {/* A long word (いらっしゃいませ) that would wrap to three-plus lines is
            clamped to two and truncated with an ellipsis rather than filling the
            tile. line-clamp sets its own -webkit-box display, so no text-balance. */}
        <span
          className={`font-kana line-clamp-2 px-0.5 leading-tight text-text [overflow-wrap:break-word] ${glyphSize(item.glyph)}`}
          lang="ja"
        >
          {item.glyph}
        </span>
        <span className="text-[9px] font-medium uppercase leading-tight tracking-[0.05em] text-accent">
          {item.typeLabel}
        </span>
      </div>
    </div>
  );
}

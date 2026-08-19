// ItemPreview — the Learn-page card for the NEXT lesson. A teaser, not the lesson:
// it shows the glyph and its TYPE (a character's roles "radical · kanji · word",
// or "word" / "counter" / a rule) — but NOT the pronunciation or meaning, which
// are learned by entering the lesson.
//
// The card is a FIXED compact size; the glyph scales down so a multi-character
// word (先生) or a long kana form (ひとつ) fits without growing the box — and
// stays on ONE line rather than wrapping mid-word (ありがと/う), the same
// shrink-to-fit contract the Library grid tiles ship (entry-tile.tsx).
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

/** Circled-digit badge glyphs for a sub-lesson's 1-based position (① ② ③ …),
 * used in place of a natural single-glyph label a tile has none of (a
 * sentence-ordering tier — see BaseContentItem.badgeNumber). Falls back to a
 * plain "N." past the Unicode circled-number block's range (①–㊿ tops out at
 * 50; no track is anywhere near that many sub-lessons today). */
const CIRCLED_DIGITS = [
  "①", "②", "③", "④", "⑤", "⑥", "⑦", "⑧", "⑨", "⑩",
  "⑪", "⑫", "⑬", "⑭", "⑮", "⑯", "⑰", "⑱", "⑲", "⑳",
];
function badgeGlyph(n: number): string {
  return CIRCLED_DIGITS[n - 1] ?? `${n}.`;
}

/** Glyph size for a MULTI-WORD Latin title only (a sentence-ordering tier,
 * "Simple sentences") — Latin text wraps at spaces, a natural boundary, so a
 * length-stepped size that still fits in two `line-clamp`d lines is enough.
 *
 * A single Japanese token — a word (ありがとう) or a grammar formula
 * (〜てはいけない) — has no such boundary: Japanese carries no spaces, so any
 * wrap point inside one is a wrap MID-WORD (ありがと/う). That case is not
 * sized here at all; ItemPreview shrinks it to fit on one line instead, via
 * the same `--chars`/`clamp()` container-query technique the Library grid
 * tiles already ship (see entry-tile.tsx). */
function glyphSize(glyph: string): string {
  const n = [...glyph].length;
  if (n <= 12) return "text-[15px]";
  if (n <= 20) return "text-[12px]";
  return "text-[11px]";
}

export function ItemPreview({ item }: { item: PreviewItem }) {
  const ghost = watermarkChar(item);
  // A badge tile (a sentence-ordering tier) shows ① in the glyph slot instead
  // of its English label, so it never hits the multi-word wrap path below —
  // and needs an aria-label, since a bare circled digit says nothing to a
  // screen reader on its own (SAK-11).
  const badge = item.badgeNumber !== undefined ? badgeGlyph(item.badgeNumber) : null;
  const glyphText = badge ?? item.glyph;
  // Only a multi-word Latin title wraps (at its spaces); a single Japanese
  // token never does — see glyphSize's comment and the span below. A badge is
  // never multi-word (it's one circled digit or "N.").
  const multiWord = !badge && /\s/.test(item.glyph);
  return (
    <div
      // [container-type:inline-size] makes this tile a query container, so the
      // glyph span below can size itself in `cqi` against the tile's own
      // content-box width — the same mechanism entry-tile.tsx uses for the
      // Library grid.
      className="relative flex h-[104px] w-[104px] shrink-0 flex-col overflow-hidden rounded-2xl border border-white/10 p-3 [container-type:inline-size]"
      style={
        {
          backgroundColor: "color-mix(in srgb, var(--card) 42%, transparent)",
        } as CSSProperties
      }
      role={badge ? "group" : undefined}
      aria-label={badge ? `Lesson ${item.badgeNumber}: ${item.glyph}` : undefined}
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
        {/* SHRINK-TO-FIT, like the Library grid tiles (entry-tile.tsx). `--chars`
            holds the code-point count and `fontSize` is 90cqi/chars split
            across it, floored at a readable 12px and capped at the 32px a
            short single-glyph word (九, 新聞) wants. `whitespace-nowrap`
            forbids the wrap a long word (いらっしゃいませ, 〜てはいけない)
            used to spill mid-word into — it shrinks to one line instead.
            A multi-word Latin title (no natural in-word break to avoid) keeps
            the old length-stepped size and clamps to two lines instead. */}
        <span
          className={
            multiWord
              ? `font-kana line-clamp-2 px-0.5 leading-tight text-text ${glyphSize(item.glyph)}`
              : "font-kana whitespace-nowrap px-0.5 leading-tight text-text"
          }
          style={
            multiWord
              ? undefined
              : ({
                  ["--chars" as string]: [...glyphText].length,
                  fontSize: "clamp(12px, calc(90cqi / var(--chars)), 32px)",
                } as CSSProperties)
          }
          lang={badge ? undefined : "ja"}
          aria-hidden={badge ? true : undefined}
        >
          {glyphText}
        </span>
        <span
          className={
            badge
              ? "line-clamp-2 text-[9px] font-medium uppercase leading-tight tracking-[0.05em] text-accent"
              : "text-[9px] font-medium uppercase leading-tight tracking-[0.05em] text-accent"
          }
          aria-hidden={badge ? true : undefined}
        >
          {badge ? item.glyph : item.typeLabel}
        </span>
      </div>
    </div>
  );
}

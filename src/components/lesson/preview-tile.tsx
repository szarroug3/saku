// The one Learn-page preview tile, shared by every track card.
//
// The Learn page is a PREVIEW, not the lesson: a tile shows the item(s) coming
// and a single greyed TYPE line ("Radical · Kanji · Word", "Counter", "Grammar",
// "Verb pair", "Keigo"), never the meaning/reading the lesson teaches.
//
// SHAPE: full-width equal columns (flex-1), a fixed-height glyph row so every
// tile is the same height whatever it holds, and the glyph shrinks to ONE line
// to fit whatever width the flex tile actually gets. The fit is pure CSS so it
// tracks the real rendered width: the tile is an inline-size container and the
// glyph font-size is 90% of the tile's inner width divided by the character
// count (CJK glyphs are ~1em wide, so N of them fit at ~90cqi/N), clamped to a
// floor and a per-track base. `base` is only the CAP for short content — a lone
// 人 sits at the base; おまわりさん or 〜てはいけない scales down instead of wrapping.

import type { CSSProperties } from "react";

import Link from "next/link";

/** Smallest the glyph may shrink to. A long keigo set can bottom out here; a
 * preview only has to show WHICH items are coming, not read at a glance. */
const TILE_GLYPH_MIN_PX = 12;

/** The tile surface:
 *   - "flat"  — the shipped look: a bordered panel on the card background.
 *   - "frost" — a translucent frosted body with a soft drop shadow and a hairline
 *     top highlight, so the tile lifts off a frosted card (no backdrop-filter, so
 *     no paint cost). */
export type PreviewTileVariant = "flat" | "frost";

export function PreviewTile({
  glyph,
  type,
  href,
  base = 34,
  variant = "flat",
}: {
  /** The item(s) shown big — a glyph, a pattern, or words joined by " · ". */
  glyph: string;
  /** The greyed type line beneath it. */
  type: string;
  /** When set, the tile links to that entry page (curriculum tiles do); a null
   * or absent href renders a plain, unlinked tile. */
  href?: string | null;
  /** The font size a single-character glyph uses; the cap for the shrink. */
  base?: number;
  /** The tile surface — flat (shipped) or frost. */
  variant?: PreviewTileVariant;
}) {
  const frost = variant === "frost";
  const body = (
    <>
      <span className={`flex items-center justify-center ${frost ? "h-[46px]" : "h-[42px]"}`}>
        <span
          className="block whitespace-nowrap font-kana font-extralight leading-none"
          style={
            {
              "--chars": [...glyph].length,
              fontSize: `clamp(${TILE_GLYPH_MIN_PX}px, calc(90cqi / var(--chars)), ${base}px)`,
            } as CSSProperties
          }
        >
          {glyph}
        </span>
      </span>
      <span
        className={`mt-1 block leading-tight text-text-muted/80 ${
          frost ? "text-[10px] uppercase tracking-[0.05em]" : "text-[10px]"
        }`}
      >
        {type}
      </span>
    </>
  );

  const cls = frost
    ? "min-w-[96px] flex-1 rounded-xl border border-border/60 bg-[color-mix(in_srgb,var(--card)_88%,transparent)] px-2 pb-3 pt-4 text-center shadow-[inset_0_1px_0_0_rgba(255,255,255,0.05),0_1px_2px_rgba(0,0,0,0.06),0_14px_28px_-22px_rgba(0,0,0,0.55)] [container-type:inline-size]"
    : "min-w-[92px] flex-1 rounded-lg border border-border px-2 pb-2.5 pt-3 text-center [container-type:inline-size]";
  const hover = frost
    ? "hover:bg-[color-mix(in_srgb,var(--card)_96%,transparent)]"
    : "hover:bg-panel";

  return href ? (
    <Link href={href} className={`${cls} ${hover} text-text no-underline`}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}

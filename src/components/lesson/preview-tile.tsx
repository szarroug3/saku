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

export function PreviewTile({
  glyph,
  type,
  href,
  base = 34,
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
}) {
  const body = (
    <>
      <span className="flex h-[42px] items-center justify-center">
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
      <span className="mt-1 block text-[10px] leading-tight text-text-muted/80">
        {type}
      </span>
    </>
  );

  const cls =
    "min-w-[92px] flex-1 rounded-lg border border-border px-2 pb-2.5 pt-3 text-center [container-type:inline-size]";

  return href ? (
    <Link href={href} className={`${cls} text-text no-underline hover:bg-panel`}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}

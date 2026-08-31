"use client";

// The most reused thing in the Grove. It appears in the Nursery picker, the
// Library grid, and the Practice deck preview, so it is built once here and
// composed everywhere rather than reimplemented per surface. Tracked as SAK-292.
//
// THE TWO ARRANGEMENTS
//
// Nursery (`lead="english"`)   the English centred, and the Japanese ONLY as a
//                              ghost in the bottom-right corner. Nothing legible
//                              in Japanese, because the whole point of the page
//                              is that you pick what to learn before you can
//                              read it. The ghost is texture, not information.
//
// Library (`lead="glyph"`)     the character centred, the English directly
//                              underneath it. No ghost: the glyph is already the
//                              hero, so a second copy behind it would just muddy
//                              the card.
//
// WHAT IS DELIBERATELY NOT ON THE CARD
//
// - The content type. The section the card sits in already says what these are,
//   so a "KANJI" label on every tile is the same word repeated twenty times.
// - A status dot. A bare coloured dot means nothing without a legend beside it.
//   Where status matters (the Library grid) it is carried by the glyph's own
//   colour instead, which needs no key to read: muted means you have not met it.

import type { ReactNode } from "react";

import { japaneseFont } from "@/grove/lib/japanese";
import { STATUS } from "@/grove/lib/tokens";
import type { GroveItem } from "@/grove/lib/types";

export type ItemCardDensity = "comfortable" | "compact";

export interface ItemCardProps {
  item: GroveItem;
  /** Which arrangement to use. Nursery picks by meaning, the Library picks by
   * character. Default `english`. */
  lead?: "english" | "glyph";
  /** Draw the corner ghost. Only applies to the English arrangement, and turns
   * OFF mid-quiz where showing the character would give away the answer.
   * Default true. */
  ghost?: boolean;
  density?: ItemCardDensity;
  selected?: boolean;
  disabled?: boolean;
  /**
   * How many pieces this pick actually commits you to, for the Nursery.
   *
   * Not an optional decoration: picking "Wednesday" is the word plus three
   * kanji plus their radicals, so it is 7 and not 1. If the card showed the
   * number of picks instead, the cart would understate exactly the overload it
   * exists to warn about. Rendered bottom-left, opposite the ghost.
   *
   * The number passed in is already deduplicated against the rest of the cart,
   * so a word sharing a radical with something you have chosen costs less here
   * than it would alone. `shared` names that saving when there is one.
   */
  pieces?: number;
  /** How many of `pieces` were already covered by other picks in the cart. */
  shared?: number;
  /** Small top-right slot: a miss count ("3x"), a pair flag, a lock reason.
   * Kept as a node so callers own the wording. */
  badge?: ReactNode;
  onClick?: () => void;
}

const BOX: Record<ItemCardDensity, string> = {
  comfortable: "min-h-[96px] px-3 py-3",
  compact: "min-h-[68px] px-2 py-2",
};

/** The ghost scales down as the glyph gets longer, so 水曜日 sits in the corner
 * the same way 水 does instead of overflowing it. */
function ghostSize(glyph: string, density: ItemCardDensity): string {
  const n = [...glyph].length;
  if (density === "compact") {
    if (n <= 1) return "text-[40px]";
    if (n <= 2) return "text-[26px]";
    return "text-[18px]";
  }
  if (n <= 1) return "text-[58px]";
  if (n <= 2) return "text-[38px]";
  if (n <= 3) return "text-[27px]";
  return "text-[21px]";
}

/** English shrinks as it lengthens so "day of the week" still fits on a tile
 * without truncating, which matters because it is the only thing on the card. */
function englishSize(text: string, density: ItemCardDensity): string {
  const n = text.length;
  if (density === "compact") return n <= 10 ? "text-[13px]" : "text-[11px]";
  if (n <= 8) return "text-[19px]";
  if (n <= 14) return "text-[16px]";
  if (n <= 22) return "text-[14px]";
  return "text-[12.5px]";
}

function glyphSize(glyph: string, density: ItemCardDensity): string {
  const n = [...glyph].length;
  if (density === "compact") {
    if (n <= 1) return "text-[26px]";
    if (n <= 3) return "text-[17px]";
    return "text-[13px]";
  }
  if (n <= 1) return "text-[38px]";
  if (n <= 2) return "text-[30px]";
  if (n <= 3) return "text-[25px]";
  return "text-[19px]";
}

export function ItemCard({
  item,
  lead = "english",
  ghost = true,
  density = "comfortable",
  selected = false,
  disabled = false,
  pieces,
  shared,
  badge,
  onClick,
}: ItemCardProps) {
  const interactive = Boolean(onClick) && !disabled;
  const Tag = interactive ? "button" : "div";

  return (
    <Tag
      {...(interactive ? { type: "button" as const, onClick } : {})}
      aria-disabled={disabled || undefined}
      className={[
        "relative isolate flex w-full flex-col items-center justify-center overflow-hidden rounded-xl text-center",
        BOX[density],
        "border bg-card transition-colors",
        selected ? "border-accent bg-accent-bg" : "border-border",
        interactive ? "hover:border-accent/60 hover:bg-panel" : "",
        disabled ? "cursor-not-allowed opacity-45" : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {/* The ghost, bottom-right, bleeding slightly off the corner so it reads as
          a watermark rather than as a second piece of content. aria-hidden: a
          screen reader should not announce a character the sighted design is
          deliberately not asking you to read. */}
      {ghost && lead === "english" ? (
        <span
          aria-hidden
          className={[
            "pointer-events-none absolute -bottom-1.5 -right-0.5 -z-10 select-none leading-none",
            "text-text opacity-[0.09]",
            ghostSize(item.glyph, density),
            japaneseFont(item.glyph),
          ].join(" ")}
        >
          {item.glyph}
        </span>
      ) : null}

      {badge ? (
        <span className="absolute right-2 top-1.5 text-[9.5px] font-semibold uppercase tracking-[0.06em] text-text-muted">
          {badge}
        </span>
      ) : null}


      {lead === "glyph" ? (
        <>
          {/* Status is carried by the glyph's own colour, so the grid scans by
              what you know without needing a key beside it. */}
          <span
            className={[
              "font-medium leading-tight",
              glyphSize(item.glyph, density),
              STATUS[item.status].glyph,
              japaneseFont(item.glyph),
            ].join(" ")}
          >
            {item.glyph}
          </span>
          <span
            className={`mt-1 w-full truncate ${
              density === "compact" ? "text-[9.5px]" : "text-[11.5px]"
            } text-text-muted`}
          >
            {item.english}
          </span>
        </>
      ) : (
        <>
          <span
            className={`font-medium leading-snug text-text ${englishSize(item.english, density)}`}
          >
            {item.english}
          </span>

          {/* What this pick actually costs, centred under the meaning and in the
              accent, because on this page the number IS the decision. Picking
              "Wednesday" is the word plus three kanji plus their radicals, so a
              card reading 1 would understate exactly the overload the Nursery
              exists to warn about. */}
          {pieces !== undefined ? (
            <span
              className={`mt-1.5 text-[10.5px] font-semibold uppercase tracking-[0.07em] text-accent ${
                selected ? "opacity-100" : "opacity-90"
              }`}
            >
              {pieces} {pieces === 1 ? "piece" : "pieces"}
              {shared ? (
                <span className="ml-1 font-medium normal-case tracking-normal text-text-muted">
                  &middot; {shared} shared
                </span>
              ) : null}
            </span>
          ) : null}
        </>
      )}
    </Tag>
  );
}

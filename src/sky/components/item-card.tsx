"use client";

// One card, two surfaces: the Planetarium picker and the Atlas grid. Tracked as
// SAK-292.
//
// It is NOT a general-purpose tile. The Quiz has its own full-width prompt and
// typed answer, and does not render items as cards at all, so nothing here is
// shaped for it.
//
// THE TWO ARRANGEMENTS
//
// Planetarium (`lead="english"`)   the English centred, and the Japanese ONLY as a
//                              ghost in the bottom-right corner. Nothing legible
//                              in Japanese, because the whole point of the page
//                              is that you pick what to learn before you can
//                              read it. The ghost is texture, not information.
//
// Atlas (`lead="glyph"`)     the character centred, its meaning directly
//                              underneath in the accent. No ghost: the glyph is
//                              already the hero, so a second copy behind it
//                              would just muddy the card.
//
// WHAT IS DELIBERATELY NOT ON THE CARD
//
// - The content type. The section the card sits in is already per type, so a
//   "KANJI" label on every tile is the same word repeated twenty times.
// - Status, in any form. A bare coloured dot means nothing without a legend
//   beside it, and tinting the glyph instead just moves the same unlabelled
//   signal somewhere more distracting. The Atlas carries status where it is
//   worded: the coverage bar and the status filter.
// - A locked state. The Planetarium lists only what you can actually take, so a
//   card that cannot be picked never reaches this component.

import { japaneseFont } from "@/sky/lib/japanese";
import type { SkyItem } from "@/sky/lib/types";

export type ItemCardDensity = "comfortable" | "compact";

export interface ItemCardProps {
  item: SkyItem;
  /** Which arrangement to use. The Planetarium picks by meaning, the Atlas by
   * character. Default `english`. */
  lead?: "english" | "glyph";
  /** `compact` is for the Atlas grid at real scale, where the job is fitting
   * a couple of hundred glyphs on screen at once. */
  density?: ItemCardDensity;
  selected?: boolean;
  /**
   * How many pieces this pick commits you to: every distinct node in its
   * prerequisite tree, counted once. Planetarium only.
   *
   * Not an optional decoration. If the card showed the number of picks instead,
   * it would say 1 for a word that is really eight things to learn, and
   * understate exactly the overload the Planetarium exists to warn about.
   *
   * A piece reached by more than one parent is still one piece. For a word made
   * of kanji A and kanji B, where A is built from radicals A and B and B is
   * built from radicals A and C, radical A is counted once:
   *
   *     word + kanji A + radical A + radical B + kanji B + radical C = 6
   *
   * So the number is intrinsic to the item and stays comparable between cards.
   * It does not shift depending on what else is in the cart; the cart's own
   * total does that deduplication across picks, where it can be explained.
   */
  pieces?: number;
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

/** English shrinks as it lengthens so "to open something" still fits on a tile
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
  density = "comfortable",
  selected = false,
  pieces,
  onClick,
}: ItemCardProps) {
  const isButton = Boolean(onClick);
  const Tag = isButton ? "button" : "div";

  return (
    <Tag
      {...(isButton ? { type: "button" as const, onClick } : {})}
      className={[
        "relative isolate flex w-full flex-col items-center justify-center overflow-hidden rounded-xl text-center",
        BOX[density],
        "border bg-card transition-colors",
        selected ? "border-accent bg-accent-bg" : "border-border",
        isButton ? "hover:border-accent/60 hover:bg-panel" : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {/* The ghost, bottom-right, bleeding off the corner so it reads as a
          watermark rather than as a second piece of content. It belongs to the
          English arrangement only, and needs no prop to switch it off: the
          Atlas leads with the glyph, where a copy behind it would be noise.
          aria-hidden, because a screen reader should not announce a character
          the sighted design is deliberately not asking you to read. */}
      {lead === "english" ? (
        <span
          aria-hidden
          className={[
            "pointer-events-none absolute -bottom-1.5 -right-0.5 -z-10 select-none whitespace-nowrap leading-none",
            "text-text opacity-[0.09]",
            ghostSize(item.glyph, density),
            japaneseFont(item.glyph),
          ].join(" ")}
        >
          {item.glyph}
        </span>
      ) : null}

      {lead === "glyph" ? (
        <>
          <span
            className={[
              "font-medium leading-tight text-text",
              glyphSize(item.glyph, density),
              japaneseFont(item.glyph),
            ].join(" ")}
          >
            {item.glyph}
          </span>
          <span
            className={`mt-1 w-full truncate text-accent ${
              density === "compact" ? "text-[9.5px]" : "text-[11.5px]"
            }`}
          >
            {item.english}
          </span>
        </>
      ) : (
        <>
          {/* The meaning takes all the space left over and centres inside it, so
              a name that wraps to two lines grows upward instead of shoving the
              cost line down. */}
          <span
            className={`flex flex-1 items-center justify-center font-medium leading-snug text-text ${englishSize(item.english, density)}`}
          >
            {item.english}
          </span>

          {/* What the pick commits you to, in the accent because on this page
              the number IS the decision. Anchored to the bottom so it sits on
              one line across a whole row, which is what makes two cards
              comparable at a glance. */}
          {pieces !== undefined ? (
            <span className="shrink-0 pt-1.5 text-[10.5px] font-semibold uppercase tracking-[0.07em] text-accent">
              {pieces} {pieces === 1 ? "piece" : "pieces"}
            </span>
          ) : null}
        </>
      )}
    </Tag>
  );
}

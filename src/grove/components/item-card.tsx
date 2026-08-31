"use client";

// The most reused thing in the Grove. It appears in the Nursery picker, the
// Library grid, and the Practice deck preview, so it is built once here and
// composed everywhere rather than reimplemented per surface. Tracked as SAK-292.
//
// THE TREATMENT
//
// The big Japanese glyph stays as a ghost in the BACKGROUND, and the English sits
// in FRONT of it. Both, layered — not one or the other.
//
// That combination is what lets the Nursery be English-only (you pick what to
// learn before you can read it) while still looking like Saku. A ghosted glyph
// reads as texture rather than as information, so it gives the card its identity
// without leaking the answer.
//
// `lead` flips which one is the foreground, because the Library leads with the
// glyph while the Nursery leads with the meaning. Same card, same ghost, one prop.

import type { ReactNode } from "react";

import { japaneseFont } from "@/grove/lib/japanese";
import { KIND_DOT, STATUS } from "@/grove/lib/tokens";
import type { GroveItem } from "@/grove/lib/types";

export type ItemCardDensity = "comfortable" | "compact";

export interface ItemCardProps {
  item: GroveItem;
  /** Which side of the card is the foreground. Nursery picks by meaning, the
   * Library picks by character. Default `english`. */
  lead?: "english" | "glyph";
  /** Draw the ghost glyph behind. Turn OFF mid-quiz, where showing the character
   * at all would give away the answer. Default true. */
  ghost?: boolean;
  density?: ItemCardDensity;
  selected?: boolean;
  disabled?: boolean;
  /** Small corner slot: a piece cost ("7 pieces"), a miss count ("3x"), a pair
   * flag. Kept as a node so callers own the wording. */
  badge?: ReactNode;
  onClick?: () => void;
}

const PAD: Record<ItemCardDensity, string> = {
  comfortable: "min-h-[104px] p-3",
  compact: "min-h-[72px] p-2",
};

/** The ghost scales down as the glyph gets longer, so 水曜日 fills the card the
 * same way 水 does instead of overflowing it. */
function ghostSize(glyph: string, density: ItemCardDensity): string {
  const n = [...glyph].length;
  if (density === "compact") {
    if (n <= 1) return "text-[52px]";
    if (n <= 2) return "text-[34px]";
    return "text-[24px]";
  }
  if (n <= 1) return "text-[76px]";
  if (n <= 2) return "text-[50px]";
  if (n <= 3) return "text-[36px]";
  return "text-[28px]";
}

function leadSize(text: string, density: ItemCardDensity): string {
  const n = [...text].length;
  if (density === "compact") return n <= 3 ? "text-[20px]" : "text-[13px]";
  if (n <= 2) return "text-[30px]";
  if (n <= 4) return "text-[22px]";
  return "text-[15px]";
}

export function ItemCard({
  item,
  lead = "english",
  ghost = true,
  density = "comfortable",
  selected = false,
  disabled = false,
  badge,
  onClick,
}: ItemCardProps) {
  const status = STATUS[item.status];
  const front = lead === "glyph" ? item.glyph : item.english;
  const back = lead === "glyph" ? item.english : item.glyph;

  const interactive = Boolean(onClick) && !disabled;
  const Tag = interactive ? "button" : "div";

  return (
    <Tag
      {...(interactive ? { type: "button" as const, onClick } : {})}
      aria-disabled={disabled || undefined}
      className={[
        "relative isolate flex w-full flex-col justify-end overflow-hidden rounded-xl text-left",
        PAD[density],
        "border bg-card transition-colors",
        selected ? "border-accent bg-accent-bg" : "border-border",
        interactive ? "hover:border-accent/60 hover:bg-panel" : "",
        disabled ? "cursor-not-allowed opacity-45" : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {/* The ghost. aria-hidden because the same character is already announced
          by the visible text below — a screen reader should not hear it twice.
          Low opacity keeps it behind the foreground's contrast floor. */}
      {ghost ? (
        <span
          aria-hidden
          className={[
            "pointer-events-none absolute -right-1 -top-1 -z-10 select-none leading-none",
            "text-text opacity-[0.07]",
            ghostSize(item.glyph, density),
            japaneseFont(item.glyph),
          ].join(" ")}
        >
          {item.glyph}
        </span>
      ) : null}

      {/* Status marker. Colour alone never carries the meaning: the title
          attribute names it, and every surface that uses this card also renders
          a legend. */}
      <span
        title={status.label}
        className={`absolute right-2 top-2 h-1.5 w-1.5 rounded-full ${status.dot}`}
      />

      {badge ? (
        <span className="absolute left-2 top-2 text-[10px] font-semibold uppercase tracking-[0.06em] text-text-muted">
          {badge}
        </span>
      ) : null}

      <span
        className={[
          "font-medium leading-tight",
          leadSize(front, density),
          lead === "glyph" ? status.glyph : "text-text",
          japaneseFont(front),
        ].join(" ")}
      >
        {front}
      </span>

      {/* The other half, small and muted. In the Nursery this is the reading or
          nothing; the point of the page is that you choose by meaning. */}
      {lead === "glyph" ? (
        <span className="mt-0.5 truncate text-[11px] text-text-muted">{back}</span>
      ) : item.reading ? (
        <span
          className={`mt-0.5 truncate text-[11px] text-text-muted ${japaneseFont(item.reading)}`}
        >
          {item.reading}
        </span>
      ) : null}

      <span className="mt-1 flex items-center gap-1.5">
        <span className={`h-1 w-1 rounded-full ${KIND_DOT[item.kind]}`} aria-hidden />
        <span className="text-[9.5px] font-medium uppercase tracking-[0.09em] text-text-muted">
          {item.kind}
        </span>
      </span>
    </Tag>
  );
}

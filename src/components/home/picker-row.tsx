"use client";

// One row tile — the K row, the Combo じ row. The picker's only box, and the
// only place it spends chrome.
//
// Three states, and they must be tellable apart at a glance across a 54-tile
// grid: all-on is a solid accent edge over an accent fill, partial is a DASHED
// accent edge over the plain fill (the edge says "this row is in play", the
// fill says "not all of it"), none is the plain border. The per-character
// opacity then says exactly WHICH ones inside a partial row.
//
// rounded-[10px] is load-bearing, not a taste call. globals.css hangs the
// per-theme card treatments off `rounded-xl bg-card` / `rounded-lg bg-card` /
// `rounded-full border`, and kiri's frost rule names these tiles explicitly as
// excluded: 214 characters across ~54 tiles is the one place in the app where
// a backdrop-filter per tile would actually cost something, and aizome would
// dissolve every tile's border into a hairline and take the three states with
// it. A radius no theme selector matches is how the tiles opt out.

import type { KanaChar } from "@/types";

import { AccuracyRing } from "./accuracy-ring";

function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

export function PickerRow({
  chars,
  enabled,
  pct,
  onToggleRow,
  onToggleChar,
}: {
  /** The row's characters — already narrowed to the search matches, if any. */
  chars: KanaChar[];
  enabled: Record<string, boolean>;
  /** Row accuracy under the configured metric; null = never practised. */
  pct: number | null;
  onToggleRow: () => void;
  onToggleChar: (c: string) => void;
}) {
  const on = chars.filter((ch) => enabled[ch.c]).length;
  const all = on === chars.length;
  const part = on > 0 && !all;

  return (
    <div
      onClick={onToggleRow}
      className={cx(
        "flex cursor-pointer select-none items-center gap-2 rounded-[10px] border px-2.5 py-2",
        all
          ? "border-accent bg-accent-bg"
          : part
            ? "border-dashed border-accent bg-card"
            : "border-border bg-card",
      )}
    >
      <span className="min-w-0">
        {/* Kana first and biggest. The legacy tile led with 13px semibold
            romaji over 16px kana, which put the label above the thing being
            labelled — you are picking characters, so the characters lead. */}
        <span className="block font-kana text-[17px] leading-[1.45]">
          {chars.map((ch) => (
            <span
              key={ch.c}
              title={`${ch.r.join(" / ")} — click to toggle just this one`}
              onClick={(e) => {
                e.stopPropagation();
                onToggleChar(ch.c);
              }}
              // hover:bg-panel is the fix for the picker's least discoverable
              // behaviour: nothing but a tooltip ever said a single glyph was
              // its own target. The padding doubles as a usable hit area.
              className={cx(
                "inline-block cursor-pointer rounded-[5px] px-1 hover:bg-panel",
                enabled[ch.c] ? "text-text" : "text-text-muted opacity-45",
              )}
            >
              {ch.c}
            </span>
          ))}
        </span>
        <span className="mt-0.5 block px-1 text-[10px] leading-tight text-text-muted">
          {chars.map((ch) => ch.r[0]).join(" ")}
        </span>
      </span>
      {/* No dashed placeholder here, unlike the deck cards: 54 dashed rings on
          a day-one picker is noise, so an unpractised row simply has no ring. */}
      <AccuracyRing pct={pct} unpractised="hidden" />
    </div>
  );
}

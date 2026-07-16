"use client";

// The tile every Home shelf is built from, plus its two readouts: the accuracy
// ring and the volume bar.
//
// Deliberately rounded-[12px] rather than the kit's rounded-xl Card: globals.css
// hangs per-theme card treatments off [class~="rounded-xl"][class~="bg-card"]
// (aizome dissolves those into hairline rules, kiri frosts them), which suits a
// full-width card and not a 3-up grid of small tiles. The character picker's row
// tiles opt out the same way.

import { type ReactNode } from "react";

import { formatAccuracy } from "@/lib/accuracy";
import type { AccuracyMetric } from "@/types";

import { AccuracyRing } from "./accuracy-ring";

function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

/** How this metric's number should be read aloud in a subtitle. */
export function metricWord(metric: AccuracyMetric): string {
  return metric === "firstTry" ? "first try" : "of attempts";
}

/** "1 character" / "12 characters". */
export function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? "" : "s"}`;
}

/**
 * Practice volume, drawn RELATIVE to the busiest deck on the shelf rather than
 * to any absolute target — the honest claim is "you drill this one less than
 * that one", not "you are 20% done".
 */
export function VolumeBar({ seen, max }: { seen: number; max: number }) {
  // No deck practised yet — a row of empty bars says nothing, and 0/0 is NaN.
  if (max <= 0) return null;
  return (
    // Spans, not divs: these render inside a <button>, where block-level
    // children are invalid HTML and trip React's hydration checks.
    <span className="mt-1.5 block h-[3px] w-full overflow-hidden rounded-full bg-panel">
      <span
        className="block h-full rounded-full bg-accent opacity-80"
        style={{ width: `${Math.round((100 * seen) / max)}%` }}
      />
    </span>
  );
}

/** One shelf tile. Always a button — every card on Home starts something. */
export function DeckCard({
  glyph,
  label,
  subtitle,
  pct,
  volume,
  smart,
  dashed,
  disabled,
  onClick,
}: {
  glyph: ReactNode;
  label: string;
  subtitle: string;
  /** Accuracy for the ring: a number, null for never-practised (dashed ring),
   * or omitted for no ring at all. */
  pct?: number | null;
  volume?: ReactNode;
  /** Accent treatment for the history-derived "target a weakness" tiles. */
  smart?: boolean;
  /** Dashed edge: this one opens a chooser rather than drilling. */
  dashed?: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  // Spelled out rather than left to name-from-contents: the glyph is a
  // decorative face, and the ring's percentage is the one thing on the card
  // that exists purely as a picture.
  const ringLabel =
    pct === undefined
      ? ""
      : pct === null
        ? "not practised yet"
        : `${formatAccuracy(pct)} accuracy`;

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      aria-label={[label, subtitle, ringLabel].filter(Boolean).join(". ")}
      className={cx(
        "relative flex min-h-[92px] cursor-pointer flex-col items-start gap-0.5",
        "rounded-[12px] border p-3 text-left",
        "disabled:cursor-default disabled:opacity-45",
        smart
          ? "border-accent/40 bg-accent-bg"
          : dashed
            ? "border-dashed border-border bg-card"
            : "border-border bg-card",
      )}
    >
      {pct === undefined ? null : (
        <span className="absolute right-2.5 top-2.5">
          {/* A never-practised deck is one dashed ring on a shelf of six, and
              that reads as information. */}
          <AccuracyRing pct={pct} unpractised="dashed" />
        </span>
      )}
      <span
        aria-hidden="true"
        className="mb-0.5 font-kana text-[22px] font-extralight leading-tight opacity-80"
      >
        {glyph}
      </span>
      <span
        className={cx(
          "text-[13px] font-semibold leading-tight",
          smart && "text-accent",
        )}
      >
        {label}
      </span>
      <span className="text-[11px] leading-snug tabular-nums text-text-muted">
        {subtitle}
      </span>
      {volume}
    </button>
  );
}

/** The 3-across grid both shelves sit on. */
export function Shelf({ children }: { children: ReactNode }) {
  return <div className="mb-3.5 grid grid-cols-3 gap-2">{children}</div>;
}

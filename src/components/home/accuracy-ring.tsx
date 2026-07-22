"use client";

// The accuracy ring — the app's ONLY one. Home's deck cards, the character
// picker's rows, the stats deck tiles and the results hero all render this, so
// a percentage means and looks like the same thing everywhere it appears.
//
// Drawn as an SVG circle with a dashed stroke rather than the conic-gradient +
// centre-plug it used to be. The conic had two faults the plug couldn't hide:
// the 0°/360° join left a hairline seam, and the arc's leading edge was a hard
// gradient stop, which is not antialiased — so the "circle" showed nicks and
// unfilled slivers, worst at the low and high percentages. A stroked circle is
// one continuous path: the browser antialiases both ends, there is no join to
// seam, and 100% is a closed ring by construction rather than a gradient that
// has to land exactly on itself.
//
// It also needs no plug: the band IS the drawing, so the middle is simply
// transparent and whatever surface the ring sits on shows through.
//
// The class tokens are load-bearing, not taste: globals.css hangs its per-theme
// rules off `rounded-full border` (aizome squares that to 2px, kiri frosts it,
// momentum shelves it), which the dashed placeholder wants and the filled ring
// must not have — the ring stays a circle in every theme precisely because it
// carries no `border`.

import { formatAccuracy } from "@/lib/accuracy";

/** What to draw when `pct` is null — i.e. when the thing was never practised. */
export type UnpractisedRing =
  /** A dashed empty ring. One of these on a shelf of six reads as information. */
  | "dashed"
  /** Nothing at all. 54 dashed rings on a day-one picker is just noise. */
  | "hidden";

/**
 * Accuracy as a filled arc. `pct === null` means never practised, and callers
 * say how that should read: the number is hidden, never zeroed, because a 0%
 * you never earned is a lie.
 *
 * The label always carries its unit (formatAccuracy), so a ring can never be
 * misread as a count of anything.
 */
export function AccuracyRing({
  pct,
  unpractised,
  size = 34,
  stroke = 3.5,
  arc = "var(--arc)",
  labelClassName = "text-[9px] tabular-nums text-text",
}: {
  pct: number | null;
  unpractised: UnpractisedRing;
  /** Outer diameter in px. */
  size?: number;
  /** Band width in px. */
  stroke?: number;
  /** Arc colour. A token or a var() — never a literal. */
  arc?: string;
  /** Typography for the centred percentage. */
  labelClassName?: string;
}) {
  if (pct === null) {
    if (unpractised === "hidden") return null;
    return (
      <span
        title="not practiced yet"
        // `block`: these spans sit inside a <button>, and an inline span
        // ignores width/height outright.
        className="kq-material block flex-none rounded-full border border-dashed border-border bg-panel"
        style={{ height: size, width: size }}
      />
    );
  }

  // The stroke straddles the path, so the circle's radius is inset by half a
  // band — otherwise the ring would be clipped by the viewBox.
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  // A percentage outside 0–100 would draw a second lap or a negative dash.
  const safe = Math.min(100, Math.max(0, pct));

  return (
    <span
      title="Accuracy from your session history"
      className="relative grid flex-none place-items-center rounded-full"
      style={{ height: size, width: size }}
    >
      <svg
        aria-hidden="true"
        viewBox={`0 0 ${size} ${size}`}
        className="absolute inset-0"
        style={{ height: size, width: size }}
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--arc-track)"
          strokeWidth={stroke}
        />
        {/* dashoffset walks a single full-circumference dash back from the
            12 o'clock start. At 100% the offset is 0 — a closed ring, no join
            to seam; at 0% the dash is fully retracted and nothing paints. */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={arc}
          strokeWidth={stroke}
          strokeDasharray={c}
          strokeDashoffset={c * (1 - safe / 100)}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>
      <span className={`relative ${labelClassName}`}>{formatAccuracy(pct)}</span>
    </span>
  );
}

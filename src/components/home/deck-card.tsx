"use client";

// The tile every Home shelf is built from, plus its one readout: the accuracy
// ring.
//
// ONE PERCENTAGE PER CARD. A volume bar used to sit under the subtitle,
// filled relative to the busiest deck on the shelf. It was reported as
// illegible and removed: its denominator was invisible (nothing on the card
// said what it was a proportion OF), and a second bar-shaped mark beside the
// accuracy ring read as a second accuracy — "46 characters, seen 68, a bar at
// ~30% and a circle saying 88%" was the report, and the honest answer to "what
// is the 30%?" was "nothing you can get from this card". The goal it served —
// telling a well-evidenced 88% from a fluke — belongs to the "seen 68×" clause
// in the subtitle, which states the same fact absolutely instead of relatively.
// Don't reintroduce a second graphical percentage here.
//
// A CARD SELECTS. IT DOES NOT START. Every card here used to fire a quiz on
// click, and the report that killed that design was "it's not clear that
// clicking a deck will start a quiz" — which is unanswerable, because a card
// that looks like a card should select and only a button should launch. So
// this is a toggle now: it reports a CardState and asks for a flip, and the
// only thing on Home that starts anything is the start bar's Start button.
//
// THREE STATES, THREE SIGNALS, NO FOURTH. Selected is accent border + accent
// tint + accent title — which already says "selected" three times. A checkbox
// was tried here and cut: it was a fourth telling of the same fact, and it sat
// in the top-right corner, which meant it displaced the accuracy ring. The
// ring is information you can't get anywhere else on this shelf; a checkbox is
// a restatement of the border you are already looking at. The ring keeps the
// corner. Partial is the dashed accent edge over the plain fill, exactly as
// the picker's rows draw it — the edge says "in play", the fill says "not all
// of it".
//
// Deliberately rounded-[12px] rather than the kit's rounded-xl Card: globals.css
// hangs per-theme card treatments off [class~="rounded-xl"][class~="bg-card"]
// (aizome dissolves those into hairline rules), which suits a full-width card
// and not a 3-up grid of small tiles. The character picker's row tiles opt out
// the same way.
//
// THIS TILE IS THE REASON `kq-material` EXISTS. Opting out of rounded-xl above
// used to opt out of kiri's frost as well, because the frost was granted by
// matching `rounded-xl` + `bg-card` — so choosing a geometry silently chose a
// material, and this tile paid 8.0 dE of "different material" for a decision
// that was only ever about corner radius. It asks for the material by name now,
// and the ask is on the SHARED class string rather than the `bg-card` branch,
// so a selected tile (`bg-accent-bg`) stays the same substance as an
// unselected one. Under the old fill-keyed recipe it did not.

import { type ReactNode } from "react";

import { formatAccuracy } from "@/lib/accuracy";
import type { AccuracyMetric } from "@/types";

import { AccuracyRing } from "./accuracy-ring";
import type { CardState } from "./selection";

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

/* VolumeBar was here, and its own doc comment said "if that import goes, delete
 * this" — Statistics was the last importer, and it has stopped. The bar drew
 * practice volume relative to the busiest deck: an invisible denominator, and a
 * second percentage-shaped mark beside an accuracy ring that actually is a
 * percentage. cfg.showVolume now gates the `seen 68×` clause on both screens,
 * which is the same fact stated absolutely. */

/** One shelf tile. A toggle over the selection — or, with `state` omitted, a
 * plain button for the one card that isn't a deck (Custom, which opens the
 * picker). */
export function DeckCard({
  glyph,
  label,
  subtitle,
  pct,
  state,
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
  /** Where this card's characters stand in the selection. Omitted for cards
   * that select nothing (Custom), which get no toggle affordance either. */
  state?: CardState;
  /** Accent treatment for the history-derived "target a weakness" tiles. */
  smart?: boolean;
  /** Dashed edge: this one opens a chooser rather than selecting characters. */
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

  const on = state === "on";
  const part = state === "partial";

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      // The selection state has to reach a screen reader somehow, and it can't
      // ride the border. aria-pressed is the toggle-button contract; "partial"
      // has no aria-pressed value ("mixed" is checkbox-only), so the subtitle
      // carries it in words — "12 of 46 on" — which it has to anyway.
      aria-pressed={state === undefined ? undefined : on}
      aria-label={[label, subtitle, ringLabel].filter(Boolean).join(". ")}
      className={cx(
        "kq-material relative flex min-h-[92px] cursor-pointer flex-col items-start gap-0.5",
        "rounded-[12px] border p-3 text-left",
        "disabled:cursor-default disabled:opacity-45",
        // Accent tint and accent edge mean SELECTED here and nothing else.
        // The weakness tiles used to carry that same tint permanently as their
        // "the app computed this one" badge, which was fine when nothing was
        // selectable and is a straight lie now — three cards that look picked
        // before you have picked anything. Their identity moved to the warm
        // glyph below, which selection never touches, so the two facts stay
        // readable at the same time.
        on
          ? "border-accent bg-accent-bg"
          : part
            ? "border-dashed border-accent bg-card"
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
        className={cx(
          "mb-0.5 font-kana text-[22px] font-extralight leading-tight opacity-80",
          // --warning, not --accent: accent is the selection's colour on this
          // shelf, and a permanently-accent glyph on a card you haven't picked
          // is the same lie the tint was. Warm reads as "your weak spots" and
          // is orthogonal to on/off in all four themes.
          smart && "text-warning opacity-100",
        )}
      >
        {glyph}
      </span>
      <span
        className={cx(
          "text-[13px] font-semibold leading-tight",
          on && "text-accent",
        )}
      >
        {label}
      </span>
      <span className="text-[11px] leading-snug tabular-nums text-text-muted">
        {subtitle}
      </span>
    </button>
  );
}

/** The 3-across grid both shelves sit on. */
export function Shelf({ children }: { children: ReactNode }) {
  return <div className="mb-3.5 grid grid-cols-3 gap-2">{children}</div>;
}

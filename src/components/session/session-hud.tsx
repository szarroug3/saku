"use client";

// The strip above every session screen: what you're running, where you are in
// it, and the one way out. Deliberately the same furniture on all three
// screens (fork, rest, complete) so the loop reads as one place you stay in
// rather than three pages you're bounced between.

import type { ReactNode } from "react";

import { SmallBtn } from "@/components/ui";

export function SessionHud({
  label,
  sublabel,
  where,
  pct,
  tone = "accent",
  float,
  onDone,
  onEnd,
  doneLabel = "Done for now",
  endLabel = "End session",
  children,
}: {
  /** What's running — "Review · 20". */
  label: string;
  /** A quiet second pill beside the first — used by the teach phase to name the
   * subject being taught ("Kanji", "Words") next to the "N of M" position.
   * Same pill furniture as `label`; omitted when there's nothing to say. */
  sublabel?: string;
  /** Where you are — "round 1 · done", "resting", "complete". */
  where: string;
  /** Bar fill, 0–100. */
  pct: number;
  /** The bar's colour. The rest's bar is deliberately grey: it is elapsing,
   * not progressing, and painting it accent would make waiting look like
   * achieving. */
  tone?: "accent" | "muted" | "success";
  /**
   * Float the strip at the top of the viewport instead of scrolling away with
   * the page: `sticky top-0 z-10 px-3 py-1.5`, the same geometry the three quiz
   * HUDs wear (drill-screen, grid-hud, pairs-hud), so the lesson's chrome reads
   * as the same furniture the drill's does.
   *
   * IT ALSO BECOMES A `kq-band`, and only when it floats. A lesson is a long
   * scrolling page, so a floating strip has a readings table, a stroke diagram
   * and a wall of example words passing directly beneath it. The strip used to
   * declare no material at all, which is fine on drill and pairs (their stage
   * fits the viewport, so nothing ever passes under the pills) and wrong here:
   * in kiri --card and --band-fill are both transparent and --material-frost is
   * none, so the pills were bare outlines over live text and the rows read
   * straight through the bar. `kq-band` is the app's word for "I am a sticky
   * band over the page's ground and I must occlude" (globals.css, CARD
   * MATERIAL): the three opaque themes lay down --bg under it, and kiri smears
   * what is passing with blur(18px) saturate(150%).
   *
   * The blur is honest work and not the scroll-lag mistake. This element IS
   * inside the scroller, so its backdrop moves and the filter recomputes as you
   * scroll. What made kiri lag was N of those at once, one per translucent card
   * on a page full of them. A band is exactly ONE, which is the same budget the
   * grid quiz measured its own sticky scrim at: 214 cards passing under a single
   * blurred band came in at p95 17.6ms with nothing dropped, identical to
   * painting no blur at all (see the GRID QUIZ SHEET note). Do not conclude from
   * this that a card may have one again.
   *
   * The hairline is where the frost stops. Opaque themes end a solid strip on
   * it, kiri ends the blur on it, and both need the edge stated or the bar has
   * no bottom.
   */
  float?: boolean;
  /** Omitted on the complete screen, which has nothing left to leave. */
  onDone?: () => void;
  /** Optional explicit end action that completes the session immediately. */
  onEnd?: () => void;
  doneLabel?: string;
  endLabel?: string;
  children?: ReactNode;
}) {
  return (
    <div
      className={`px-3 py-1.5 ${
        float ? "kq-band sticky top-0 z-10 border-b border-border" : ""
      }`}
    >
      <div className="mb-2 flex flex-wrap items-center gap-2 text-[11px] text-text-muted">
        <span className="kq-material rounded-full border border-border px-2.5 py-0.5">
          {label}
        </span>
        {sublabel ? (
          <span className="kq-material rounded-full border border-border px-2.5 py-0.5">
            {sublabel}
          </span>
        ) : null}
        <span className="tabular-nums">{where}</span>
        <span className="ml-auto flex items-center gap-1.5">
          {children}
          {onEnd ? <SmallBtn onClick={onEnd}>{endLabel}</SmallBtn> : null}
          {onDone ? <SmallBtn onClick={onDone}>{doneLabel}</SmallBtn> : null}
        </span>
      </div>
      <div className="h-(--bar-h) overflow-hidden rounded-full bg-panel">
        <div
          className={`h-full rounded-full transition-[width] duration-200 ${
            tone === "muted"
              ? "bg-text-muted"
              : tone === "success"
                ? "bg-success"
                : "bg-accent"
          }`}
          style={{ width: `${Math.max(0, Math.min(100, pct))}%` }}
        />
      </div>
    </div>
  );
}

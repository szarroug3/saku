"use client";

// The stroke-order diagram — the real thing, drawn from KanjiVG data.
//
// WHAT IT RENDERS
// ===============
// Two views of the same ordered strokes, side by side:
//
//   1. An ANIMATED diagram, looping. The character draws itself stroke by
//      stroke, in order, via an SVG stroke-dashoffset animation (each path
//      normalised to pathLength=1 so one keyframe fits every stroke); the
//      finished glyph then holds for a beat before the cycle starts over, so
//      you can watch it as many times as you need without a control to press.
//      Under prefers-reduced-motion there is no animation at all: the finished
//      glyph is shown still, and the numbered chart below carries the order.
//
//      HOW THE STAGGER SURVIVES LOOPING
//      Every stroke runs the SAME animation on the SAME clock — one cycle
//      length, no delay — and takes its turn via a per-stroke linear() easing
//      that holds the stroke undrawn until its moment, draws it, then holds it
//      drawn for the rest of the cycle. The obvious alternative, staggering
//      with animation-delay, only staggers the FIRST iteration: after that
//      every stroke loops on its own offset clock and the character is never
//      whole at any instant. See strokeEase() below.
//
//   2. A STEP-BY-STEP numbered chart — the classic KanjiVG sequence. One small
//      cell per stroke: cell i shows strokes 1..i with the newest stroke picked
//      out in the accent colour and the ones before it faint, and the stroke's
//      ordinal under it. Reading left to right is watching the character built.
//
// COLOUR
// ======
// Everything is drawn in theme tokens — var(--text) for drawn strokes,
// var(--accent) for the stroke being introduced, var(--border) for the writing
// guide — so it reads on all four palettes in light and dark.
//
// DATA
// ====
// Strokes come from src/lib/strokes.ts (lazy). This component is only mounted
// with real data; the loading / no-data cases are the caller's (how-its-written).

import { useSyncExternalStore, type CSSProperties } from "react";

import { STROKE_GRID, type GlyphStrokes } from "@/lib/strokes";

const REDUCED_MOTION = "(prefers-reduced-motion: reduce)";

function subscribeReducedMotion(onChange: () => void): () => void {
  const mq = window.matchMedia(REDUCED_MOTION);
  mq.addEventListener("change", onChange);
  return () => mq.removeEventListener("change", onChange);
}

/** useSyncExternalStore rather than an effect: no post-mount setState, SSR
 * snapshot is "no". Mirrors the pattern in the quiz HUDs. */
function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(
    subscribeReducedMotion,
    () => window.matchMedia(REDUCED_MOTION).matches,
    () => false,
  );
}

/** Timing for the draw-along, in seconds. Each stroke draws over DRAW, then a
 * short GAP before the next begins; once the last one lands the finished
 * character HOLDs before the loop starts over. The hold is what keeps a loop
 * from reading as a strobe — it's the beat where you actually see the glyph. */
const DRAW = 0.7;
const GAP = 0.18;
const HOLD = 1.4;

/** Seconds for one full pass over `n` strokes, including the closing hold. */
function cycleSeconds(n: number): number {
  return Math.max(1, n - 1) * (DRAW + GAP) + DRAW + HOLD;
}

/**
 * The easing that gives stroke `i` its turn.
 *
 * The keyframes run undrawn→drawn over the WHOLE cycle; this curve decides
 * when within that cycle the progress actually moves. It pins progress at 0
 * until the stroke's start, ramps linearly to 1 over DRAW, then pins it at 1
 * to the end — so the stroke waits, draws, and stays drawn until every stroke
 * has landed and the shared clock wraps.
 */
function strokeEase(i: number, cycle: number): string {
  const pct = (s: number) => `${((s / cycle) * 100).toFixed(3)}%`;
  const start = i * (DRAW + GAP);
  return `linear(0 0%, 0 ${pct(start)}, 1 ${pct(start + DRAW)}, 1 100%)`;
}

/** The faint square-plus writing guide behind every diagram — the same crutch a
 * genkō-yōshi practice box gives, so the eye can judge balance. */
function Guide() {
  const c = STROKE_GRID / 2;
  return (
    <g stroke="var(--border)" strokeWidth={1} fill="none">
      <rect x={1} y={1} width={STROKE_GRID - 2} height={STROKE_GRID - 2} rx={4} />
      <line x1={c} y1={4} x2={c} y2={STROKE_GRID - 4} strokeDasharray="3 5" />
      <line x1={4} y1={c} x2={STROKE_GRID - 4} y2={c} strokeDasharray="3 5" />
    </g>
  );
}

/** The looping draw-along. When `animate` is false every stroke is shown
 * finished and nothing moves — the reduced-motion still. */
function DrawAlong({
  strokes,
  animate,
}: {
  strokes: string[];
  animate: boolean;
}) {
  const cycle = cycleSeconds(strokes.length);
  return (
    <svg
      viewBox={`0 0 ${STROKE_GRID} ${STROKE_GRID}`}
      className="h-32 w-32 shrink-0"
      role="img"
      aria-label="Stroke-order animation"
    >
      <Guide />
      <g
        fill="none"
        stroke="var(--text)"
        strokeWidth={4.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {strokes.map((d, i) => (
          <path
            key={i}
            d={d}
            pathLength={1}
            strokeDasharray={1}
            className={animate ? "animate-kvg-draw" : undefined}
            style={
              animate
                ? ({
                    "--kvg-draw-cycle": `${cycle}s`,
                    "--kvg-draw-ease": strokeEase(i, cycle),
                  } as CSSProperties)
                : undefined
            }
          />
        ))}
      </g>
    </svg>
  );
}

/** One cell of the numbered chart: strokes 1..upTo, the last picked out. */
function StepCell({ strokes, upTo }: { strokes: string[]; upTo: number }) {
  return (
    <div className="flex flex-col items-center gap-1">
      <svg
        viewBox={`0 0 ${STROKE_GRID} ${STROKE_GRID}`}
        className="h-12 w-12"
        role="img"
        aria-label={`Stroke ${upTo}`}
      >
        <Guide />
        <g fill="none" strokeWidth={4.5} strokeLinecap="round" strokeLinejoin="round">
          {strokes.slice(0, upTo).map((d, i) => {
            const isNew = i === upTo - 1;
            return (
              <path
                key={i}
                d={d}
                stroke={isNew ? "var(--accent)" : "var(--text-muted)"}
                opacity={isNew ? 1 : 0.4}
              />
            );
          })}
        </g>
      </svg>
      <span className="text-[10px] leading-none text-text-muted">{upTo}</span>
    </div>
  );
}

/**
 * The full stroke-order display for a glyph that has data.
 */
export function StrokeOrder({ data }: { data: GlyphStrokes }) {
  const reduced = usePrefersReducedMotion();
  const { strokes } = data;
  const steps = Array.from({ length: strokes.length }, (_, i) => i + 1);

  return (
    <div className="mt-1">
      <div className="flex flex-wrap items-start gap-4">
        {/* The draw-along. It loops on its own, so there is nothing to press. */}
        <div className="rounded-lg border border-border bg-card p-1">
          <DrawAlong strokes={strokes} animate={!reduced} />
        </div>

        {/* The numbered step-by-step chart. */}
        <div className="min-w-0 flex-1">
          <p className="mb-1.5 text-[11px] text-text-muted">
            Stroke by stroke
          </p>
          <div className="flex flex-wrap gap-2">
            {steps.map((n) => (
              <StepCell key={n} strokes={strokes} upTo={n} />
            ))}
          </div>
        </div>
      </div>

      {/* NO INLINE CREDIT HERE, AND THAT IS NOT AN OVERSIGHT.
          The stroke data is KanjiVG's (© Ulrich Apel and contributors, CC BY-SA
          3.0) and MUST be credited. It is — on /about/data, which every screen
          that renders this component reaches through the AttributionLink in its
          footer. CC BY-SA 3.0 asks for credit "in any reasonable manner", and a
          credits screen one click away from the diagram is that; a line of 10px
          legalese under every character was not the only way to satisfy it.
          If you add a screen that renders this component, it needs an
          AttributionLink in its footer too — src/data/attribution.test.ts fails
          if it doesn't, and that failure is a licence violation, not a lint. */}
    </div>
  );
}

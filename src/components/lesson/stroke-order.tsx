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
// AND ONE LINE OF PROSE
// =====================
// Under the two of them, WRITTEN_VS_PRINTED: the note that a handwritten shape
// and a printed one do not always trace over each other. It is here because
// KanjiVG is a HANDWRITING model and the headword above is a typeface, the two
// genuinely differ (on 人 the strokes fork at the apex in every Japanese face on
// a Mac and a third of the way down in KanjiVG), and a learner shown two
// drawings with no word about it has to guess which one is the character. The
// reasoning, and why this is copy instead of a fix, is on the constant in
// src/data/why.ts.
//
// DATA
// ====
// Strokes come from src/lib/strokes.ts (lazy). This component is only mounted
// with real data; the loading / no-data cases are the caller's (how-its-written).

import {
  useCallback,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
} from "react";

import { WRITTEN_VS_PRINTED } from "@/data/why";
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
 * How many ROWS of frames the chart shows before it offers to open up.
 *
 * THE CUT IS BY ROWS, NOT BY A COUNT, and that is the whole reason this needs
 * measuring rather than a `slice`. A fixed count has to be wrong on one screen
 * or the other: 12 frames is two tidy rows on a laptop and six on a phone.
 * Cutting by rows means a wide window simply shows more per row and fewer rows
 * are hidden — one rule that produces the right answer at every width, with no
 * breakpoint to keep in sync.
 *
 * Two rows because of the measured distribution: kana top out at 4 strokes (き
 * is 4, not 3) so they never truncate at any width, and of 2,136 kanji the
 * median is 10 — 1,095 sit at 1–10 and only 11 are past 21. The cap exists for
 * the tail (鬱 is 29 and printed 29 cells before this), not for the common case.
 */
const COLLAPSED_ROWS = 2;

/** One frame's full height: the 48px cell, the 4px gap under it, and the ordinal.
 * Kept beside the markup it measures — `h-12`, `gap-1`, `text-[10px]
 * leading-none` — because a change there and not here silently clips a row. */
const CELL_H = 62;
/** `gap-2` between wrapped rows. */
const ROW_GAP = 8;

function collapsedHeight(rows: number): number {
  return rows * CELL_H + (rows - 1) * ROW_GAP;
}

/**
 * The full stroke-order display for a glyph that has data.
 */
export function StrokeOrder({ data }: { data: GlyphStrokes }) {
  const reduced = usePrefersReducedMotion();
  const { strokes } = data;
  const steps = Array.from({ length: strokes.length }, (_, i) => i + 1);

  const [open, setOpen] = useState(false);
  // Whether the frames actually overflow the collapsed height AT THIS WIDTH.
  // Measured rather than inferred from the stroke count, for the same reason the
  // cut is by rows: at 29 strokes a wide window may still fit two rows, and
  // offering to "show all" when everything is already shown is a control that
  // does nothing.
  const [clipped, setClipped] = useState(false);
  const frames = useRef<HTMLDivElement>(null);

  const measure = useCallback(() => {
    const el = frames.current;
    if (!el) return;
    setClipped(el.scrollHeight > collapsedHeight(COLLAPSED_ROWS) + 1);
  }, []);

  // Layout effect + a resize observer: the answer depends on the element's
  // width, which is not known until after layout and changes when the window
  // does. An effect alone would flash the wrong state on first paint.
  useLayoutEffect(() => {
    measure();
    const el = frames.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [measure, strokes.length]);

  return (
    <div className="mt-1 @container">
      {/* SIDE BY SIDE ONCE THERE IS ROOM FOR BOTH, STACKED BELOW THAT.
          The frames live in their own column beside the animation and wrap
          INSIDE it, and `flex-nowrap` is what holds that: let the row wrap on
          its own and a long kanji drops the whole chart underneath the diagram
          at every width, which is the layout this pairing exists to avoid.

          On a phone there is no room for the pairing at all. The animation is a
          fixed 138px of the ~330px a card gets at 390px, so the frame column was
          down to three cells a row and the "Show all 29 strokes" button, which
          cannot wrap mid-word, ran past the card edge. Under @md the two views
          stack and the frames get the full width — six a row instead of three,
          so the chart is SHORTER stacked than it was squeezed.

          A container query, not a media query, and for the reason the whole
          component measures rather than counts: this card sits in a one-column
          page and in a two-column split, and what decides the layout is the
          width this card actually got. Same idiom as mark-view and the term
          pages. */}
      <div className="flex flex-col items-start gap-4 @md:flex-row @md:flex-nowrap">
        {/* The draw-along. It loops on its own, so there is nothing to press. */}
        <div className="rounded-lg border border-border bg-card p-1">
          <DrawAlong strokes={strokes} animate={!reduced} />
        </div>

        {/* The numbered step-by-step chart. No heading: these are numbered
            frames under a card already titled "How it's written", and naming
            them twice is the card explaining itself.

            `min-w-0` IS LOAD-BEARING and is not the same as `flex-1`. A flex
            item's default `min-width: auto` refuses to shrink below its content,
            so without this a 29-frame chart forces the row wider than its
            container and the row breaks rather than the frames wrapping — the
            exact failure the `flex-nowrap` above is trying to prevent. */}
        {/* `w-full` carries the stacked case: in a column the flex basis is a
            HEIGHT, so without it the frames size to their content and wrap at
            the widest cell instead of at the card edge. */}
        <div className="w-full min-w-0 @md:flex-[1_1_0]">
          <div
            ref={frames}
            className="flex flex-wrap gap-2 overflow-hidden"
            style={open ? undefined : { maxHeight: collapsedHeight(COLLAPSED_ROWS) }}
          >
            {steps.map((n) => (
              <StepCell key={n} strokes={strokes} upTo={n} />
            ))}
          </div>
          {/* EXPANDS IN PLACE. Never a modal: this page IS the reference, and a
              dialog puts a dismissal between the reader and the thing they came
              for — and costs them reading the strokes and the mnemonic together,
              which is the pairing the page is arranged around. */}
          {clipped || open ? (
            <button
              type="button"
              onClick={() => setOpen(!open)}
              className="mt-1.5 cursor-pointer border-none bg-transparent p-0 text-[11px] text-text-muted underline"
            >
              {open ? "Show fewer" : `Show all ${strokes.length} strokes`}
            </button>
          ) : null}
        </div>
      </div>

      {/* The handwritten-vs-printed note. UNDER THE WHOLE ROW, not beside the
          animation: it is about both views at once, and about the headword the
          reader has already scrolled past, so it reads as a caption on the
          diagram and not as a footnote to the numbered chart.

          Always shown, never behind a disclosure. The reader who needs it is
          the one who has NOT noticed the two shapes disagree yet, and asking
          them to open something to find that out is asking a question they do
          not know they have. Quiet enough (11px, muted) to be skipped by the
          reader who does not care. */}
      <p className="mt-3 text-[11px] leading-relaxed text-text-muted">
        {WRITTEN_VS_PRINTED}
      </p>

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

"use client";

// SAK-131: the option board every multiple-choice-shaped quiz card renders —
// an MC card, a sentence-recognition card, and the particle marker-choice
// card all draw the same wrapping, up-to-3-per-row tile row (see SAK-54's
// comment history for why this is a flex-wrap row and not a CSS grid: a grid
// with fixed column tracks always reserves all three, so a 2-option board
// reads as pinned left instead of centered). Previously drill-screen.tsx
// implemented that row three separate times (once per board), and
// /dev/quiz-gallery/page.tsx hand-copied a FOURTH, older version of it (a
// fixed `grid-cols-3` that never got the SAK-54 fix) — this component is the
// one shared implementation both now import.
//
// Purely presentational: it takes the options pre-built (label, correctness,
// wrongness already resolved by the caller) and reports a tap via `onSelect`.
// It never decides what "correct" means for a board — that stays with each
// caller's own grading, since an MC option, a recognition option and a
// particle-marker option are graded three different ways upstream.

import { useLayoutEffect, useRef } from "react";

import { fitFontSizeRem, MC_OPTION_MAX_FONT_REM } from "./mc-option-fit";

function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

export interface McOptionGridItem {
  /** Unique across this board's options — becomes the React key. */
  readonly key: string;
  readonly label: React.ReactNode;
  /** Lit green once `revealing`. */
  readonly correct: boolean;
  /** Lit red once `revealing`, alongside the correct option's green (SAK-50's
   * wrong-pick-stays-lit convention). Never true at the same time as
   * `correct`. */
  readonly wrong?: boolean;
  /** en2jp MC options roll a per-option JP font at ask time; every other
   * board (recognition, particle-marker, the gallery's reference cards)
   * leaves this unset and renders in the page's default font. */
  readonly fontFamily?: string;
}

export interface McOptionGridProps {
  readonly options: readonly McOptionGridItem[];
  /**
   * Whether to show the graded reveal colors at all. REQUIRED, no default —
   * see PitchClipBoard's identical choice. A shared component whose default
   * happened to match the gallery's "always revealed" static-preview need
   * would make the LIVE quiz's real behavior (never reveal until answered)
   * the exception a caller has to remember to opt into, backwards from what
   * matters: the live drill is the real app, the gallery is the preview of
   * it. Every caller, live or gallery, states its own intent explicitly.
   */
  revealing: boolean;
  /** Recognition options are full sentences and need to wrap and shrink
   * (`text-sm hyphens-auto`); every other board's options are a single short
   * token or glyph and want the larger `text-xl`. */
  size?: "lg" | "sm";
  /** Called with the tapped option's `key` and index. Omit for a fully inert
   * board — the gallery's reference cards never select anything, so they
   * leave this unset. */
  onSelect?: (key: string, index: number) => void;
}

/**
 * SAK-207: `size="lg"` options are meant to be a single short token or glyph
 * on one line — `wrap-break-word` (still used by `size="sm"` below) exists to
 * keep long text from overflowing its tile, but for `lg` it was doing that by
 * breaking a pattern like 〜てはいけない mid-character-run, which reads far
 * worse than the overflow it was preventing. The fix is real measurement, not
 * a CSS clamp: an arbitrary Japanese option's rendered width can't be known
 * ahead of time, so this hooks each `lg` tile's label span with a ref,
 * measures its natural (unwrapped) width against the tile's available width
 * after layout, and shrinks the font just enough to land it on one line — see
 * fitFontSizeRem in mc-option-fit.ts for the actual sizing math (split out
 * because that part IS unit-testable; this DOM-measurement half isn't — a
 * headless node:test has no layout engine to measure against, so this half is
 * verified by reading, not by a test).
 *
 * WHY useLayoutEffect: it runs after the DOM is up but before the browser
 * paints, so the shrink is applied before the first frame the learner sees —
 * a plain useEffect would let the wrapped, full-size text paint for one frame
 * first and then visibly snap down, which is the exact flash this exists to
 * avoid.
 *
 * WHY A RESIZE OBSERVER: the tile width is `calc((100%-16px)/3)` of a
 * `min(92vw, 480px)` row, so it changes with the viewport, not just at mount
 * — a phone rotated or a window resized after the quiz is already on screen
 * needs the same re-measurement a fresh mount gets. Observing the row
 * (rather than `window`'s resize event) also covers any other reason the row
 * changes width, e.g. sidebar layout shifts, with one mechanism.
 *
 * WHY document.fonts.ready: en2jp options roll a per-option JP font at ask
 * time (see McOptionGridItem.fontFamily above), and a web font can still be
 * loading when this first measurement runs — measuring against the fallback
 * font's metrics and never re-checking once the real font swaps in would
 * leave a stale, possibly-wrong shrink applied. Measuring again once fonts
 * finish loading catches that; the `cancelled` flag only guards against a
 * post-unmount setState-equivalent (a DOM write here, not React state), and
 * `document.fonts` is optional-chained for the same defensiveness the
 * codebase already applies to `ResizeObserver` (see stroke-order.tsx).
 */
function useShrinkToFit(
  active: boolean,
  labelRefs: React.RefObject<Map<string, HTMLSpanElement>>,
  rowRef: React.RefObject<HTMLDivElement | null>,
  // Re-measure whenever the option set itself changes shape or content, not
  // just on resize — a new board (new keys, or the same keys with new text)
  // needs a fresh measurement just as much as a window resize does.
  optionsSignature: string,
) {
  useLayoutEffect(() => {
    if (!active) return;
    let cancelled = false;

    const measure = () => {
      if (cancelled) return;
      for (const el of labelRefs.current.values()) {
        // Reset to the ceiling before reading: scrollWidth reflects whatever
        // font-size is currently applied, and a stale, already-shrunk value
        // from a previous pass would understate how wide the text actually
        // wants to be.
        el.style.fontSize = `${MC_OPTION_MAX_FONT_REM}rem`;
        const natural = el.scrollWidth;
        const available = el.clientWidth;
        let target = fitFontSizeRem(natural, available);
        el.style.fontSize = `${target}rem`;
        if (target < MC_OPTION_MAX_FONT_REM) {
          // One re-check, not a loop: glyph advance widths scale with
          // font-size closely but not perfectly (kerning), so the single
          // computed size can land a hair over on some fonts. A second
          // measurement at the applied size catches that; see
          // fitFontSizeRem's comment on why this stays a single extra step
          // rather than iterating until convergence.
          const stillOverflowing = el.scrollWidth > el.clientWidth;
          if (stillOverflowing) {
            target = fitFontSizeRem(el.scrollWidth, available, target);
            el.style.fontSize = `${target}rem`;
          }
        }
      }
    };

    measure();

    const row = rowRef.current;
    let ro: ResizeObserver | undefined;
    if (row && typeof ResizeObserver !== "undefined") {
      ro = new ResizeObserver(measure);
      ro.observe(row);
    }

    void document.fonts?.ready.then(measure);

    return () => {
      cancelled = true;
      ro?.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, optionsSignature]);
}

/** The exact option-tile row every MC-shaped quiz board renders. */
export function McOptionGrid({
  options,
  revealing,
  size = "lg",
  onSelect,
}: McOptionGridProps) {
  const rowRef = useRef<HTMLDivElement>(null);
  // Keyed by option key rather than index: React swaps DOM nodes by key, and
  // a Map lets each tile's ref attach/detach itself (see setLabelRef below)
  // without this component tracking which index is which across renders.
  const labelRefs = useRef(new Map<string, HTMLSpanElement>());

  const isLg = size === "lg";
  // Only `lg` shrinks — `sm` (full sentence-recognition options) is meant to
  // wrap and hyphenate, and must stay completely unaffected by any of this.
  useShrinkToFit(
    isLg,
    labelRefs,
    rowRef,
    options.map((o) => o.key).join("|"),
  );

  const setLabelRef = (key: string) => (el: HTMLSpanElement | null) => {
    if (el) labelRefs.current.set(key, el);
    else labelRefs.current.delete(key);
  };

  return (
    <div
      ref={rowRef}
      className="flex w-[min(92vw,480px)] flex-wrap justify-center gap-2"
    >
      {options.map((o, i) => (
        <button
          key={o.key}
          type="button"
          onClick={onSelect ? () => onSelect(o.key, i) : undefined}
          style={o.fontFamily ? { fontFamily: o.fontFamily } : undefined}
          className={cx(
            "flex min-h-[60px] shrink-0 grow-0 basis-[calc((100%-16px)/3)] cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border px-3 py-2 text-center",
            size === "sm" ? "text-sm hyphens-auto wrap-break-word" : "text-xl",
            revealing && o.correct
              ? "border-success bg-success-bg text-success"
              : revealing && o.wrong
                ? "border-danger bg-danger-bg text-danger"
                : "border-border bg-card text-text hover:bg-panel",
          )}
        >
          <span
            ref={isLg ? setLabelRef(o.key) : undefined}
            // `w-full` gives the span a measurable box independent of its
            // text (a bare inline span sizes to content, which would make
            // clientWidth just track scrollWidth and always "fit"). Flex
            // items blockify per spec, so `w-full` applies even though a
            // `span` is inline by default. `whitespace-nowrap` is what makes
            // scrollWidth trustworthy as the text's true one-line width
            // instead of a wrapped, container-clamped one; `overflow-hidden
            // text-ellipsis` is only a backstop for the (unexercised in
            // practice, given the floor) case where even the minimum size
            // doesn't fit — truncation, not a mid-word break, is the right
            // failure there.
            className={
              isLg
                ? "w-full overflow-hidden text-ellipsis whitespace-nowrap"
                : undefined
            }
          >
            {o.label}
          </span>
          <span className="text-[10px] text-text-muted">{i + 1}</span>
        </button>
      ))}
    </div>
  );
}

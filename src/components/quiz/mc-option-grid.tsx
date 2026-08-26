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
 * SAK-207: `wrap-break-word` (still used by `size="sm"` below) exists to keep
 * long text from overflowing its tile, but for `lg` it was doing that by
 * breaking a pattern like 〜てはいけない mid-character-run, which reads far
 * worse than the overflow it was preventing.
 *
 * ROUND 2: the original fix over-corrected the other way — it forced EVERY
 * `lg` option onto one line (`white-space: nowrap`) and shrank the font to
 * make that fit, even for options with real word breaks (an English meaning
 * like "describe a noun"). That fought the tile's own fixed-width layout: a
 * flex item's default `min-width: auto` respects an unbreakable nowrap
 * label's full-width min-content, so a wide-enough option (before its OWN
 * shrink pass had run) could force its tile past its `calc((100%-16px)/3)`
 * basis, throwing off how many tiles fit per row — the reported "boxes
 * aren't staying 2 row / 3 column" bug. `min-w-0` on the tile fixes that
 * structurally (a fixed-basis flex item can no longer be forced wider by its
 * own content), but the right fix for the wrapping question is per-option:
 * an option whose rendered text contains NO whitespace (a single unbreakable
 * token — a JP pattern, a glyph) keeps the original one-line shrink-to-fit
 * treatment, since wrapping can't help it anyway. An option whose text DOES
 * contain whitespace gets no shrink at all — it simply wraps at its own word
 * boundaries within the tile's now-fixed width, which is what "shrink AND
 * wrap, never mid-word" actually asks for: wrapping already solves the fit
 * for breakable text, so forcing a shrink on top of it would just make
 * already-legible text needlessly smaller.
 *
 * The fix is real measurement either way, not a CSS clamp: an arbitrary
 * option's rendered width can't be known ahead of time, so this hooks each
 * `lg` tile's label span with a ref, measures its natural (unwrapped) width
 * against the tile's available width after layout, and — for the
 * no-wrap-points case only — shrinks the font just enough to land it on one
 * line. See fitFontSizeRem in mc-option-fit.ts for the actual sizing math
 * (split out because that part IS unit-testable; this DOM-measurement half
 * isn't — a headless node:test has no layout engine to measure against, so
 * this half is verified by reading, not by a test).
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
        // SAK-207 round 2: an option with a real word break wraps at full
        // size and needs none of the shrink machinery below — reset it to
        // the ceiling, let it wrap, and move on. Checked on every pass (not
        // just once) since a re-measure can follow the SAME text swapping in
        // via a different call (e.g. a resize while the board is up), and
        // this stays cheap either way — one string scan, no layout read.
        const canWrap = /\s/.test(el.textContent ?? "");
        if (canWrap) {
          el.style.whiteSpace = "normal";
          el.style.overflow = "";
          el.style.textOverflow = "";
          el.style.fontSize = `${MC_OPTION_MAX_FONT_REM}rem`;
          continue;
        }
        // No wrap points — the original one-line shrink-to-fit treatment.
        // `white-space: nowrap` is what makes scrollWidth trustworthy as the
        // text's true one-line width instead of a wrapped, container-
        // clamped one; `overflow: hidden` + `text-overflow: ellipsis` is
        // only a backstop for the (unexercised in practice, given the floor)
        // case where even the minimum size doesn't fit — truncation, not a
        // mid-word break, is the right failure there.
        el.style.whiteSpace = "nowrap";
        el.style.overflow = "hidden";
        el.style.textOverflow = "ellipsis";
        // Reset to the ceiling before reading: scrollWidth reflects whatever
        // font-size is currently applied, and a stale, already-shrunk value
        // from a previous pass would understate how wide the text actually
        // wants to be.
        el.style.fontSize = `${MC_OPTION_MAX_FONT_REM}rem`;
        const natural = el.scrollWidth;
        // `- 1`: found while verifying this fix — clientWidth/scrollWidth
        // are both integer-rounded by the browser's own layout APIs, so a
        // target that lands EXACTLY at the rounded available width can still
        // be a genuine sub-pixel over in actual (fractional) rendering,
        // which the ellipsis backstop then silently swallows a whole
        // trailing character to fix — e.g. 〜てはいけない losing its last
        // two characters even though this measurement read as an exact fit.
        // A 1px margin costs nothing visible and absorbs that rounding gap.
        const available = el.clientWidth - 1;
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
            "flex min-h-[60px] min-w-0 shrink-0 grow-0 basis-[calc((100%-16px)/3)] cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border px-3 py-2 text-center",
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
            // `span` is inline by default.
            //
            // SAK-207 round 2: white-space/overflow/text-overflow are no
            // longer set here — useShrinkToFit decides them PER OPTION, since
            // whether wrapping is even possible depends on the option's own
            // text, not on `size`. A single unbreakable token (a JP pattern
            // like 〜てはいけない, no spaces to wrap at) still gets the
            // original one-line shrink-to-fit treatment; an option with real
            // word breaks (an English phrase like "describe a noun") gets
            // NO shrink at all — it just wraps within the tile's fixed width,
            // which was the whole ask (shrink AND wrap, never mid-word — see
            // the ticket). Never wrap-break-word either way: that's what
            // broke a single JP token mid-character in the first place.
            className={isLg ? "w-full" : undefined}
          >
            {o.label}
          </span>
          <span className="text-[10px] text-text-muted">{i + 1}</span>
        </button>
      ))}
    </div>
  );
}

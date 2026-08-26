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

import {
  fitFontSizeRem,
  MC_OPTION_MAX_FONT_REM,
  MC_OPTION_MIN_FONT_REM,
  shrinkFontToFitHeight,
} from "./mc-option-fit";

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
 * worse than the overflow it was preventing. Round 1 fixed that but forced
 * EVERY `lg` option onto one line (`white-space: nowrap` + shrink), even
 * multi-word English phrases with real word breaks like "describe a noun".
 *
 * ROUND 2 fixed THAT over-correction by branching per option: text with a
 * real word break wrapped at full size with no shrink; a single unbreakable
 * token kept the one-line shrink-to-fit. It also fixed a real layout bug
 * along the way — a flex item's default `min-width: auto` respects an
 * unbreakable nowrap label's full-width min-content, so a wide option
 * (before its own shrink pass had run) could force its tile past its fixed
 * `calc((100%-16px)/3)` basis, throwing off how many tiles fit per row.
 * `min-w-0` on the tile (still below) fixes that structurally regardless of
 * the label's own wrap/shrink state.
 *
 * But round 2's per-option branch treated "wraps" and "shrinks" as
 * ALTERNATIVES, picked by whether an option's text happened to contain a
 * space — backwards from what was actually asked for, and it surfaced a bug
 * of its own: the tile was still only `min-h-[60px]`, a FLOOR, so any option
 * that wrapped grew ITS OWN row taller than sibling rows (flex's default
 * cross-axis stretch then matched every OTHER tile in that row to it). A
 * real 6-option board could render two visibly different-height rows —
 * exactly the "boxes aren't staying the same size" Sam reported live, even
 * though the 3/3 column layout itself was already correct.
 *
 * ROUND 3 (this fix): the tile is now a genuinely FIXED height
 * (`h-[6.25rem]` below — see MC_OPTION_TILE_HEIGHT_REM in mc-option-fit.ts
 * for the full derivation), not a `min-h` floor, and EVERY `lg` option — not
 * just the ones with word breaks — is allowed to both wrap AND shrink to fit
 * inside it, never mid-word (round 1's fix, unchanged: `overflow-wrap` stays
 * the browser default `normal`, never `wrap-break-word`).
 *
 * measure() below still branches per option on whether the text has a real
 * word break (a space) — same `canWrap` test round 2 used — but what that
 * branch now decides is narrower and more honest than round 2's version:
 * ONLY which CSS makes a break impossible for the no-space case, never
 * whether shrinking happens. Both branches share the same fixed box and the
 * same "shrink AND wrap as needed" goal; only the WRAP-PREVENTION mechanism
 * for a spaceless token differs from the wrap-ALLOWING mechanism for
 * everything else.
 *
 * That per-option branch exists because of a real bug caught in LIVE review
 * (not code-reading) after an earlier version of this fix tried to make the
 * CSS itself fully uniform via `word-break: keep-all` (Tailwind's
 * `break-keep`) for every option, banking on "a token with no spaces has no
 * valid break point under `keep-all`, so it can't usefully wrap anyway."
 * That's wrong: `keep-all` only forbids a break BETWEEN TWO CJK IDEOGRAPHS —
 * it explicitly still allows one adjacent to a non-ideographic character.
 * 〜 (U+301C WAVE DASH, a symbol) leads nearly every grammar pattern in this
 * app, and 〜てはいけない was actually rendering as "〜" alone on one line
 * and "てはいけない" on the next — two lines that both fit within the tile,
 * so the width-based residual fix never even saw an overflow to correct.
 * There's no way to tell `word-break` "treat this specific symbol as glued
 * to its neighbor" — it only ever classifies break OPPORTUNITIES by script.
 * `white-space: nowrap` is the only thing that makes a break impossible
 * ANYWHERE in a string regardless of adjacent characters, so a genuinely
 * unbreakable option (no whitespace anywhere in its OWN text) gets that
 * instead — see measure()'s `canWrap` branch below.
 *
 * For the no-space branch, only WIDTH constrains the result (forced
 * single-line content trivially satisfies any height budget in range), so it
 * skips the height search entirely and goes straight to the same direct
 * width-based fit (`fitFontSizeRem` in mc-option-fit.ts) rounds 1/2 used.
 *
 * For the has-a-space branch, the fit search runs height-first, from the
 * TRUE CEILING (`MC_OPTION_MAX_FONT_REM`), via `shrinkFontToFitHeight` (in
 * mc-option-fit.ts — read its own header comment for why height can't be
 * solved directly the way width can): it steps the font size down,
 * remeasuring the WRAPPED text's real `scrollHeight` at each step, until it
 * fits the tile's fixed available height or the floor
 * (`MC_OPTION_MIN_FONT_REM`) is reached. Most such options fit on the very
 * first measurement and never shrink at all — with wrapping allowed at full
 * size, only text that's genuinely too tall even once wrapped needs to
 * shrink. (Deliberately NOT starting from a width-based single-line
 * approximation: that would pre-shrink perfectly wrappable text before
 * wrapping even gets a chance to solve the fit for free — precisely round
 * 2's own regression, reintroduced from the other direction. See
 * fitFontSizeRem's own comment.) A width-based residual check still runs
 * afterwards as defense (an embedded word longer than the tile even once
 * wrapped around, or ordinary kerning drift) — correctly-wrapped content
 * should never actually trip it, since a wrapped line is never wider than
 * its container by definition.
 *
 * A short option just ends up with extra empty space (centered —
 * `justify-center` on the tile) in the same fixed box a long option fills
 * after shrinking and/or wrapping.
 *
 * fitFontSizeRem's own sizing math IS unit-tested (mc-option-fit.test.ts);
 * shrinkFontToFitHeight's SEARCH MECHANICS are too, via a fake
 * `measureHeightPx`. What isn't, any round: the DOM measurement itself, and
 * the exact CSS line-breaking behavior around characters like 〜 — a
 * headless node:test has no layout engine to check either against, so this
 * half is verified by reading (and, this round, by live browser
 * verification that caught what reading alone missed), not by a test.
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
        const button = el.parentElement;
        const indexLabel = el.nextElementSibling as HTMLElement | null;
        if (!button) continue;

        // Available height for the label, measured LIVE from the tile — not
        // from a hardcoded px figure derived from an assumed 16px root, so
        // this stays correct regardless of the browser's actual root
        // font-size. `button.clientHeight` already includes vertical padding
        // (but not the border, under `box-sizing: border-box`); subtracting
        // the padding, the `gap-1` row gap, and the index sub-label's own
        // (fixed, never-shrinking) height leaves exactly what's left for the
        // label to grow into.
        const buttonStyle = getComputedStyle(button);
        const paddingY =
          (parseFloat(buttonStyle.paddingTop) || 0) +
          (parseFloat(buttonStyle.paddingBottom) || 0);
        const gapPx = parseFloat(buttonStyle.rowGap || buttonStyle.gap) || 0;
        const indexHeight = indexLabel?.clientHeight ?? 0;
        const availableHeight =
          button.clientHeight - paddingY - gapPx - indexHeight;

        // SAK-207 round 3, corrected after live verification caught a real
        // regression: `word-break: keep-all` (the static `break-keep` class
        // below) does NOT make a spaceless token unbreakable in general — it
        // only forbids a break BETWEEN TWO CJK IDEOGRAPHS. It explicitly
        // still permits one adjacent to a non-ideographic character, and
        // 〜 (U+301C WAVE DASH — a symbol, not a CJK ideograph) leads nearly
        // every grammar pattern in this app. Live-verified in the browser:
        // 〜てはいけない was rendering as "〜" alone on its own line and
        // "てはいけない" below it — TWO lines, both narrower than the tile,
        // so `scrollWidth > clientWidth` was false and the width-based
        // residual fix (below) never even engaged. There's no CSS knob that
        // tells `word-break` to treat a specific symbol as glued to its
        // neighbor — it only ever classifies break OPPORTUNITIES by script.
        // The one thing that makes a break truly impossible anywhere in a
        // string, regardless of what characters are adjacent, is
        // `white-space: nowrap` — which is what round 1/2 used originally,
        // and what a genuinely unbreakable option (no whitespace ANYWHERE in
        // its own text — the only thing `keep-all` was ever trying to
        // approximate) needs here too, unconditionally.
        const canWrap = /\s/.test(el.textContent ?? "");

        if (!canWrap) {
          // `nowrap` guarantees zero line breaks anywhere in this token, so
          // only WIDTH constrains it — the height search below is
          // meaningless here (forced single-line content trivially fits the
          // box's height budget at any font size) and is skipped entirely in
          // favor of the same direct width-based fit rounds 1/2 used.
          el.style.whiteSpace = "nowrap";
          // Reset to the ceiling before reading: scrollWidth reflects
          // whatever font-size is currently applied, and a stale,
          // already-shrunk value from a previous pass would understate how
          // wide the text actually wants to be.
          el.style.fontSize = `${MC_OPTION_MAX_FONT_REM}rem`;
          const naturalWidth = el.scrollWidth;
          // `- 1`: found while verifying round 2 — clientWidth/scrollWidth
          // are both integer-rounded by the browser's own layout APIs, so a
          // target landing EXACTLY at the rounded available width can still
          // be a genuine sub-pixel over in actual (fractional) rendering —
          // e.g. 〜てはいけない silently losing its last two characters even
          // though the measurement read as an exact fit. A 1px margin
          // absorbs that.
          const availableWidth = el.clientWidth - 1;
          let target = fitFontSizeRem(naturalWidth, availableWidth);
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
              target = fitFontSizeRem(el.scrollWidth, availableWidth, target);
              el.style.fontSize = `${target}rem`;
            }
          }
          continue;
        }

        // Breakable text (has real word breaks): allow it to wrap at its own
        // word boundaries, and let the HEIGHT-FIRST search decide whether it
        // ALSO needs to shrink — the round 3 fix, unchanged from before.
        // Starting at the TRUE CEILING (MC_OPTION_MAX_FONT_REM), not a
        // width-based single-line approximation: most options fit on the
        // very first measurement and never shrink at all, since a
        // width-only guess would pointlessly pre-shrink text that wraps
        // just fine at full size (round 2's own regression, reintroduced
        // from the other direction — see fitFontSizeRem's own comment).
        el.style.whiteSpace = "normal";
        const finalRem = shrinkFontToFitHeight(
          (candidateRem) => {
            el.style.fontSize = `${candidateRem}rem`;
            return el.scrollHeight;
          },
          MC_OPTION_MAX_FONT_REM,
          availableHeight,
        );
        el.style.fontSize = `${finalRem}rem`;

        // Width-based residual fix — defense for the rarer case a breakable
        // phrase still overflows sideways (e.g. one embedded word longer
        // than the tile itself even after wrapping around it), plus the same
        // kerning-drift guard as the no-wrap branch above. Ordinary wrapped
        // text should never actually trip this: `scrollWidth` for correctly
        // wrapped content is never wider than `clientWidth` by definition.
        if (
          el.scrollWidth > el.clientWidth &&
          finalRem > MC_OPTION_MIN_FONT_REM
        ) {
          const availableWidth = el.clientWidth - 1;
          let recheckRem = fitFontSizeRem(
            el.scrollWidth,
            availableWidth,
            finalRem,
          );
          el.style.fontSize = `${recheckRem}rem`;
          if (recheckRem < finalRem && el.scrollWidth > el.clientWidth) {
            recheckRem = fitFontSizeRem(
              el.scrollWidth,
              availableWidth,
              recheckRem,
            );
            el.style.fontSize = `${recheckRem}rem`;
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
            // `h-[6.25rem]`: SAK-207 round 3's fixed tile height, replacing
            // the old `min-h-[60px]` FLOOR — see MC_OPTION_TILE_HEIGHT_REM in
            // mc-option-fit.ts for the full derivation. Kept as a literal
            // here rather than interpolated from that constant because
            // Tailwind's build-time class scanner needs a literal `h-[...]`
            // string in source to generate the utility at all.
            //
            // `overflow-hidden` (new): the fixed height means an option
            // whose text genuinely can't fit even the shrink search's 3-line
            // budget at the font floor has nowhere further to shrink or wrap
            // to — this clips it rather than letting the tile grow, since
            // "the box should not expand" was the explicit ask. Backstop
            // only; not the normal path for any real option text checked
            // against this fix.
            "flex h-[6.25rem] min-w-0 shrink-0 grow-0 basis-[calc((100%-16px)/3)] cursor-pointer flex-col items-center justify-center gap-1 overflow-hidden rounded-lg border px-3 py-2 text-center",
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
            // SAK-207 round 3: `whitespace-normal break-keep` here are just
            // the pre-measurement DEFAULT (this static class briefly applies
            // before useLayoutEffect's first synchronous pass, which always
            // runs before paint) — measure() below OVERRIDES `white-space`
            // per option every pass via inline style, since `break-keep`
            // (`word-break: keep-all`) alone turned out NOT to be enough to
            // keep a spaceless token unbreakable (live-verified regression:
            // `keep-all` only forbids a break between two CJK ideographs, and
            // still allows one next to a symbol like 〜, U+301C WAVE DASH,
            // which leads nearly every grammar pattern here — see
            // useShrinkToFit's header comment for the full story). A real
            // word break (an English phrase like "describe a noun") wraps at
            // its own word boundaries; a token with none gets `nowrap`
            // forced instead, unconditional on what characters it contains.
            // `overflow-wrap` is left at its browser default (`normal`)
            // either way — never `wrap-break-word`, which is what broke a
            // single JP token mid-character in round 1.
            className={isLg ? "w-full whitespace-normal break-keep" : undefined}
          >
            {o.label}
          </span>
          <span className="text-[10px] text-text-muted">{i + 1}</span>
        </button>
      ))}
    </div>
  );
}

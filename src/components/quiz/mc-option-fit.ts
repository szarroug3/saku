// SAK-207: the pure sizing math behind McOptionGrid's `size="lg"` shrink-to-fit,
// pulled out of mc-option-grid.tsx (a "use client" component with JSX, which the
// test runner's native TS loader cannot parse — same reason assembly-check.ts is
// split from assembly-screen.tsx) so the one part of this fix that doesn't
// require a real layout engine can still be pinned with a plain node:test. The
// DOM measurement itself (ref + useLayoutEffect, ResizeObserver, scrollWidth vs
// clientWidth) has no headless-node equivalent worth faking and stays untested;
// see mc-option-grid.tsx's own comment on that call.

/** `text-xl`, this file's own full-size token — the ceiling a `size="lg"` tile
 * starts at and never exceeds. */
export const MC_OPTION_MAX_FONT_REM = 1.25;

/** `text-sm` — the OTHER variant's fixed size, one line down in this same file.
 * Used as the floor rather than picking a new number: a `size="lg"` tile that
 * has shrunk as far as it goes is now exactly as small as the `size="sm"`
 * sentence-recognition tiles already ship at today, a size this component
 * already treats as legible, not a new smallest-text-in-the-app to justify. */
export const MC_OPTION_MIN_FONT_REM = 0.875;

/**
 * SAK-207 ROUND 3: `size="lg"`'s tile used to be `min-h-[60px]` — a FLOOR,
 * not a fixed size. Any option whose label wrapped grew ITS OWN row taller
 * than sibling rows (flex's default cross-axis stretch then matched every
 * tile in that row to it), so a 6-option board could render two visibly
 * different-height rows — exactly the "boxes aren't staying the same size"
 * Sam reported live. The fix makes the tile a genuine fixed height: every
 * `lg` tile is this tall, always, and text shrinks AND wraps (never
 * mid-word) to fit inside it, instead of the tile growing to fit the text.
 *
 * Derived, not guessed (see also mc-option-grid.tsx's className, which must
 * be kept in sync with this constant by hand — Tailwind's build-time class
 * scanner needs a literal `h-[...]` string in the JSX, so this rem value
 * can't be interpolated in there directly):
 *
 * Tailwind v4 defaults are unmodified in this project (confirmed: no
 * `--text-*` overrides in src/app/globals.css's `@theme` blocks, and no
 * `html { font-size }` override either — Preflight only sets `line-height`
 * on `html`, so `rem` stays tied to the browser's 16px default even though
 * `body` sets its own 15px `font-size`):
 *   text-xl:  font-size 1.25rem,  line-height calc(1.75/1.25)  = 1.4    (ratio)
 *   text-sm:  font-size 0.875rem, line-height calc(1.25/0.875) = 1.4286 (ratio)
 *
 * The label span keeps the `text-xl` class always — only its font-size is
 * ever overridden inline, by the shrink search below — so its line-height is
 * ALWAYS text-xl's own ratio (1.4) applied to whatever font-size is
 * currently in effect, not text-sm's slightly different ratio, even once
 * shrunk all the way down to the text-sm-matching MC_OPTION_MIN_FONT_REM
 * floor.
 *
 * Budget, from the floor upward:
 *   - up to 3 wrapped lines of label text at the floor
 *     (MC_OPTION_MIN_FONT_REM = 0.875rem):
 *       0.875 x 1.4 = 1.225rem/line x 3 lines = 3.675rem
 *     3 lines is the realistic ceiling: the longest real option text found
 *     in src/data/grammar/recipes.ts ("asserting new information (\"I'm
 *     telling you\")", 45 chars) wraps to about that many lines at the floor
 *     size within a tile's realistic content width. (This is the search's
 *     BUDGET, not a guarantee for arbitrary future strings — see
 *     shrinkFontToFitHeight below and the tile's `overflow-hidden` backstop
 *     in mc-option-grid.tsx for what happens if a string genuinely can't
 *     fit even 3 lines at the floor.)
 *   - `gap-1` between the label span and the index sub-label: 0.25rem
 *   - the index sub-label (`text-[10px] text-text-muted`, no line-height
 *     utility applied): inherits Preflight's unmodified
 *     `html { line-height: 1.5 }` at its own 10px font-size:
 *       10px x 1.5 = 15px = 0.9375rem
 *   - `py-2` vertical padding: 0.5rem x 2 = 1rem
 *   - the tile's 1px `border`, both edges, under Tailwind Preflight's
 *     `box-sizing: border-box` (so it eats into the fixed height rather than
 *     adding to it): 2px = 0.125rem
 *
 *   3.675 + 0.25 + 0.9375 + 1 + 0.125 = 5.9875rem (~95.8px at the 16px root)
 *
 * Rounded up to a clean 6.25rem (100px) — a ~4px buffer against font-metric
 * variance across platforms/browsers, not padding for its own sake:
 * 5.9875rem is the actual requirement this covers.
 *
 * NOTE: the RUNTIME fit search in mc-option-grid.tsx does NOT rely on this
 * rem figure or a 16px assumption to decide how much height is actually
 * available — it measures the live tile's `clientHeight` and subtracts the
 * real, currently-computed padding/gap/index-label height at run time, so it
 * stays correct even if the browser's effective root font-size ever differs
 * from 16px. This constant exists purely to justify and pin the STATIC
 * `h-[6.25rem]` class choice itself.
 */
export const MC_OPTION_TILE_HEIGHT_REM = 6.25;

/**
 * Given how wide an option's text renders at the max size (`naturalWidthPx`,
 * measured with wrapping disabled so it reflects the text's true one-line
 * width) and how much width the tile actually offers (`availableWidthPx`),
 * return the font size that fits it on one line, in rem.
 *
 * SINGLE COMPUTATION, NOT ITERATIVE STEPPING. A glyph's advance width scales
 * with font-size (same characters, same font, same kerning table) closely
 * enough that the target size can be solved directly — `maxRem * (available /
 * natural)` — rather than walked down in small steps or bisected. Iterating
 * one step at a time would step through several intermediate sizes before
 * landing (each one a real DOM write inside the caller's layout effect) and,
 * worse, is the exact mechanism that produces a visible flicker if any of
 * those intermediate sizes ever painted; solving for the answer directly
 * means the tile goes from unmeasured straight to its final size in one DOM
 * write, before paint. The scaling assumption isn't perfectly exact (kerning
 * pairs are not perfectly linear), so the caller re-measures once after
 * applying the computed size and nudges again if it's still a pixel over —
 * see mc-option-grid.tsx's measure().
 *
 * SAK-207 ROUND 3: this function still only answers the single-line WIDTH
 * question — it has no idea how many lines wrapped text will take, and
 * forcing every option through it BEFORE wrapping is even considered would
 * reintroduce round 2's own regression (needlessly shrinking text that would
 * have fit fine once allowed to wrap). So mc-option-grid.tsx's measure() only
 * reaches for this function directly — skipping the height search in
 * shrinkFontToFitHeight below entirely — for an option with NO whitespace in
 * its own text, forced onto one line via `white-space: nowrap` (not
 * `word-break: keep-all`; an earlier version of this fix tried relying on
 * `keep-all` alone and shipped a real regression — see measure()'s own
 * comment for the live-verified 〜-adjacent-break story). For an option WITH
 * whitespace, this function is used only as a residual fix AFTER the height
 * search, catching the rarer case a wrapped phrase still overflows sideways
 * (an embedded word wider than the tile) — see mc-option-grid.tsx's
 * measure() for both call sites.
 */
export function fitFontSizeRem(
  naturalWidthPx: number,
  availableWidthPx: number,
  maxRem: number = MC_OPTION_MAX_FONT_REM,
  minRem: number = MC_OPTION_MIN_FONT_REM,
): number {
  // Nothing to measure yet (not laid out) or already fits at full size —
  // stay at the ceiling rather than divide by a bogus width.
  if (naturalWidthPx <= 0 || availableWidthPx <= 0) return maxRem;
  if (naturalWidthPx <= availableWidthPx) return maxRem;
  const scaled = maxRem * (availableWidthPx / naturalWidthPx);
  return Math.max(minRem, Math.min(maxRem, scaled));
}

/** Step size for shrinkFontToFitHeight's search below, in rem. 0.0625rem =
 * 1px at the browser's 16px default root — fine enough that no single step
 * is visually obvious, coarse enough that MC_OPTION_MAX_SHRINK_STEPS
 * comfortably covers the whole MC_OPTION_MAX_FONT_REM-to-MC_OPTION_MIN_FONT_REM
 * range (0.375rem / 0.0625rem = 6 steps worst case — see
 * shrinkFontToFitHeight's own comment on why the caller starts the search at
 * the ceiling, not a pre-shrunk approximation, so most real options never
 * take anywhere near that many steps). */
export const MC_OPTION_SHRINK_STEP_REM = 0.0625;

/** Hard cap on shrinkFontToFitHeight's iterations. Each one is a real DOM
 * write + layout read inside the caller's single useLayoutEffect pass (see
 * mc-option-grid.tsx's WHY USELAYOUTEFFECT comment for why that pass can
 * afford several synchronous writes with zero visible flicker — only the
 * FINAL applied size is ever painted). 6 tiles x a handful of steps each is
 * cheap; unbounded stepping, or a much larger board, would not be. */
export const MC_OPTION_MAX_SHRINK_STEPS = 8;

/**
 * The height-fit half of the shrink-to-fit search. `fitFontSizeRem` above
 * solves a single-line WIDTH fit directly because glyph advance width scales
 * ~linearly with font-size. Wrapped HEIGHT doesn't have that property: line
 * count is a step function of font-size — text doesn't gradually get "less
 * wrapped" as the font shrinks, it jumps from N lines to N-1 lines at
 * whatever font-size makes the last word/character fit back onto the
 * previous line — so there's no closed form "the height is x, therefore the
 * font-size is y" the way there is for width. A bounded step-down search
 * against real measurements is the honest way to answer it.
 *
 * Takes `measureHeightPx`, a callback that applies a candidate font size and
 * returns the resulting rendered height (real usage: set the label's
 * `style.fontSize` and read `scrollHeight` — see mc-option-grid.tsx's
 * measure()), and steps `startRem` down by `stepRem` until the measured
 * height fits `availableHeightPx` or `minRem` is reached, whichever comes
 * first, bounded by `maxSteps` iterations either way.
 *
 * WHY THIS DOESN'T COST THE FLICKER fitFontSizeRem's OWN COMMENT WARNS
 * AGAINST: that warning is about avoiding VISIBLE intermediate paints across
 * multiple animation frames. This search only ever runs inside a single
 * useLayoutEffect pass, which completes before the browser paints anything —
 * every intermediate size this loop writes is overwritten before the next
 * frame, so only the final size is ever painted. The extra DOM writes/reads
 * cost bounded reflow work, not flicker. (Verified against the real wiring:
 * mc-option-grid.tsx's useShrinkToFit calls measure() synchronously inside
 * useLayoutEffect, not inside a callback deferred to a later tick.)
 *
 * This function doesn't reset `startRem` to MC_OPTION_MAX_FONT_REM itself —
 * it refines downward from wherever the caller starts it, clamped into
 * [minRem, MC_OPTION_MAX_FONT_REM] defensively. Real usage in
 * mc-option-grid.tsx's measure() only calls this for an option whose text
 * HAS a real word break — `white-space: normal` lets it wrap freely, and the
 * call always starts from MC_OPTION_MAX_FONT_REM (the true ceiling), NOT a
 * pre-shrunk width-based approximation: most such options already fit at the
 * ceiling and this search exits after its very first measurement — starting
 * from a smaller "would fit on one line" guess would pointlessly shrink text
 * that wraps just fine at full size, exactly round 2's own regression,
 * reintroduced from the other direction. An option with NO word break skips
 * this function entirely (see measure()'s `canWrap` branch) — it's forced
 * onto one line via `white-space: nowrap` instead, since `word-break:
 * keep-all` alone doesn't reliably prevent a break in every real string (a
 * leading 〜, for one — see measure()'s header comment for the live-verified
 * regression that taught us this).
 *
 * Pulled out here (rather than left inline in mc-option-grid.tsx) so the
 * SEARCH MECHANICS — start point, step size, floor, iteration bound, early
 * exit — are pinned by a real test with a fake `measureHeightPx`. The actual
 * `scrollHeight` read has no headless-node equivalent and stays untested,
 * the same split fitFontSizeRem/mc-option-grid.tsx already document — don't
 * try to fake a layout engine here either.
 */
export function shrinkFontToFitHeight(
  measureHeightPx: (candidateRem: number) => number,
  startRem: number,
  availableHeightPx: number,
  minRem: number = MC_OPTION_MIN_FONT_REM,
  stepRem: number = MC_OPTION_SHRINK_STEP_REM,
  maxSteps: number = MC_OPTION_MAX_SHRINK_STEPS,
): number {
  let rem = Math.max(minRem, Math.min(startRem, MC_OPTION_MAX_FONT_REM));
  for (let i = 0; i < maxSteps; i++) {
    const height = measureHeightPx(rem);
    if (height <= availableHeightPx || rem <= minRem) return rem;
    rem = Math.max(minRem, rem - stepRem);
  }
  return rem;
}

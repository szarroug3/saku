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

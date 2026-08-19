// Pure predicate behind the "there's more below" scroll cue — see
// src/components/ui.tsx's ScrollCue. Kept apart from the component so the
// on/off boundary is testable without a DOM (no window, no ResizeObserver).
//
// WHY THIS EXISTS
// ================
// A short viewport (a laptop with the browser chrome eating a third of it, a
// phone in landscape) can leave a quiz's multiple-choice grid running past
// the fold with nothing on screen to say so — the page scrolls (see
// layout.tsx's "THE PAGE SCROLLS, NOT AN INNER FRAME"), so scrolling always
// works, but a learner who has never needed to scroll a quiz card before has
// no reason to try. See SAK-21.

/**
 * Is the viewport within `threshold` px of the bottom of the page?
 *
 * `false` means there is more content below the fold worth hinting at.
 * `threshold` absorbs sub-pixel rounding and a hair of intentional slack —
 * scrollHeight includes the page's own bottom padding, so without it the cue
 * would flicker on right up to a pixel-perfect scroll-to-bottom.
 */
export function isNearPageBottom(
  scrollY: number,
  viewportHeight: number,
  scrollHeight: number,
  threshold = 24,
): boolean {
  return scrollY + viewportHeight >= scrollHeight - threshold;
}

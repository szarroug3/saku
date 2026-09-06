"use client";

// Whether the screen is a phone's. Read from the viewport, never guessed on
// the server, so the first client render matches the HTML and only then
// follows the real width.
//
// Most of the Sky answers this in CSS with `md:`, which is better when the
// only difference is how something is laid out. This is for the places
// where it changes what is RENDERED: the Atlas folds its rail and gives an
// open entry the whole width, and the Quiz starts with its list of cards
// closed and shows it instead of the card rather than beside it.

import { useSyncExternalStore } from "react";

/** Below Tailwind's `md`, which is what "a phone" means everywhere else in
 * the Sky. A caller with its own threshold passes one (the Quiz needs room
 * for a card AND a panel beside it, so it asks about `lg`). */
export function useNarrow(maxWidth = 767): boolean {
  return useSyncExternalStore(
    (onChange) => { const mq = window.matchMedia(`(max-width: ${maxWidth}px)`); mq.addEventListener("change", onChange); return () => mq.removeEventListener("change", onChange); },
    () => window.matchMedia(`(max-width: ${maxWidth}px)`).matches,
    () => false,
  );
}

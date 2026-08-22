"use client";

// The React half of lesson-prefs.ts — split out so that file stays pure and
// unit-testable (see its own header note). Nothing here is new behavior,
// just the hook lifted out of the module it used to force a React import
// onto.

import { useEffect, useState } from "react";

import {
  readLessonPref,
  writeLessonPref,
  type LessonPref,
} from "@/lib/lesson-prefs";

/**
 * A section's open state as a persisted toggle.
 *
 * Starts closed to match the server render, hydrates from storage after mount,
 * and writes every change back. Because the stepper remounts each section as you
 * step between items, the stored value is re-read for every item — which is
 * exactly "set once, every lesson respects it" with no shared provider to thread
 * through the tree.
 */
export function useLessonPref(pref: LessonPref): [boolean, (open: boolean) => void] {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    // Post-mount hydration — SSR can't read localStorage. Only touch state when
    // the stored value actually differs, so a closed section (the default)
    // never triggers a second render.
    const stored = readLessonPref(pref);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (stored) setOpen(true);
  }, [pref]);

  const set = (next: boolean) => {
    setOpen(next);
    writeLessonPref(pref, next);
  };

  return [open, set];
}

"use client";

// Persisted lesson preferences: whether the "how it's written" and "readings"
// sections open by default.
//
// A PREFERENCE, NOT LESSON STATE — and that is the whole point.
// ============================================================
// "Show me stroke order" is a standing choice about how you learn, not a fact
// about where you are in a lesson. So it lives in localStorage under its own
// key, exactly like the theme (see src/lib/theme.tsx), and NOT in the session
// or in any component's step state. Set it open once on あ and か opens the same
// way; open it in a kana lesson and next month's kanji lesson respects it. Close
// the tab and it is still your choice.
//
// DEFAULT CLOSED, ON PURPOSE
// ==========================
// Both start collapsed. A beginner on their first character should not have a
// stroke-order diagram and a reading table unfolded at them — the owner's rule
// is that you are unlikely to be handwriting Japanese this early and cannot read
// the kanji's readings the day you meet it. The sections are THERE, one line
// each, for the learner who wants them; they just don't open themselves.
//
// STORED RAW, READ POST-MOUNT
// ===========================
// Same shape as theme.tsx's hydration: the initial render uses the default (so
// server and client first paint agree), then an effect reads storage and, if it
// differs, flips the state. The only visible cost is a section that was left
// open flashing shut→open on a hard load — acceptable for a disclosure, and the
// common case (closed) never flashes at all.

import { useEffect, useState } from "react";

/** The two persisted sections. The value is the STORAGE KEY, so a caller names
 * the preference by its meaning and never types a raw string. */
export const LESSON_PREF_KEYS = {
  /** "How it's written" — the stroke-order section. */
  writing: "kanaquiz-lesson-writing",
  /** The kanji readings table. */
  readings: "kanaquiz-lesson-readings",
} as const;

export type LessonPref = keyof typeof LESSON_PREF_KEYS;

/** Read a persisted "is this section open?" flag. Absent / unreadable / anything
 * but the string "1" is the default (closed), so a hand-edited or blocked store
 * degrades to the calm default rather than an error. Pure and SSR-safe: no
 * window, no throw. */
export function readLessonPref(pref: LessonPref): boolean {
  try {
    return localStorage.getItem(LESSON_PREF_KEYS[pref]) === "1";
  } catch {
    return false;
  }
}

/** Persist a section's open state. "1" for open, the key removed for closed —
 * so the default reads back as closed whether it was never set or explicitly
 * shut. Swallows storage errors (private mode / disabled): the choice still
 * applies for the session, it just isn't remembered. */
export function writeLessonPref(pref: LessonPref, open: boolean): void {
  try {
    if (open) localStorage.setItem(LESSON_PREF_KEYS[pref], "1");
    else localStorage.removeItem(LESSON_PREF_KEYS[pref]);
  } catch {
    // storage blocked — the toggle still works this session
  }
}

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

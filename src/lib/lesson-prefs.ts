// Persisted lesson preferences: whether the "how it's written" and "readings"
// sections open by default.
//
// PURE ON PURPOSE — see use-lesson-pref.ts for the hook. This file has no
// React import so it can be unit-tested directly under Node's test runner
// (see lesson-prefs.test.ts); a "use client" file importing `useEffect` at
// module scope fails Node's ESM resolution outside Next's own build
// pipeline, which is exactly what broke every test in this file before the
// split.
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

import {
  LESSON_OPEN,
  LESSON_READINGS_KEY,
  LESSON_WRITING_KEY,
  OLD_LESSON_READINGS_KEY,
  OLD_LESSON_WRITING_KEY,
} from "@/lib/settings-keys";
import { pushSettings } from "@/lib/settings-sync";
import { migratedGet } from "@/lib/storage-migrate";
import type { SettingsFile } from "@/types";

/** The two persisted sections. The value is the STORAGE KEY, so a caller names
 * the preference by its meaning and never types a raw string. Renamed
 * `kanaquiz-lesson-*` → `saku-lesson-*`, legacy names migrated forward on read. */
export const LESSON_PREF_KEYS = {
  /** "How it's written" — the stroke-order section. */
  writing: LESSON_WRITING_KEY,
  /** The kanji readings table. */
  readings: LESSON_READINGS_KEY,
} as const;

/** The legacy key for each preference, for the one-time migration on read. */
const OLD_LESSON_PREF_KEYS = {
  writing: OLD_LESSON_WRITING_KEY,
  readings: OLD_LESSON_READINGS_KEY,
} as const;

export type LessonPref = keyof typeof LESSON_PREF_KEYS;

/** Read a persisted "is this section open?" flag. Absent / unreadable / anything
 * but the string "1" is the default (closed), so a hand-edited or blocked store
 * degrades to the calm default rather than an error. Pure and SSR-safe: no
 * window, no throw. */
export function readLessonPref(pref: LessonPref): boolean {
  try {
    return (
      migratedGet(localStorage, LESSON_PREF_KEYS[pref], OLD_LESSON_PREF_KEYS[pref]) ===
      LESSON_OPEN
    );
  } catch {
    return false;
  }
}

/** The server field each preference maps to. */
function settingsPatch(pref: LessonPref, open: boolean): SettingsFile {
  return pref === "writing" ? { lessonWriting: open } : { lessonReadings: open };
}

/** Persist a section's open state — locally AND to the server. "1" for open, the
 * key removed for closed — so the default reads back as closed whether it was
 * never set or explicitly shut. Swallows storage errors (private mode / disabled);
 * the server push is a no-op when no provider is mounted. */
export function writeLessonPref(pref: LessonPref, open: boolean): void {
  try {
    if (open) localStorage.setItem(LESSON_PREF_KEYS[pref], LESSON_OPEN);
    else localStorage.removeItem(LESSON_PREF_KEYS[pref]);
  } catch {
    // storage blocked — the toggle still works this session
  }
  pushSettings(settingsPatch(pref, open));
}

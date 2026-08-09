// A lesson-end quiz's snapshot is LESSON-driven, not settings-driven. This pure
// transform is applied wherever a session snapshot is frozen (see
// quiz-session.tsx) so a lesson can't inherit whatever the user has toggled for
// Practice — the bug this fixes.

import type { SessionOrigin } from "@/lib/session";
import type { QuizSnapshot } from "@/lib/quiz-session-types";

/**
 * Force a lesson-origin session's snapshot to a FULL-COVERAGE DRILL. Whatever
 * the user set for Practice, a lesson closes by drilling every taught form over
 * the material it just taught (grammar production included — `ask` is always the
 * full set now, so a full-coverage drill reaches every form).
 *
 *   - `mode`   → "drill", EXCEPT the `assembly` pin (a sentence-ordering lesson
 *     keeps its closing assembly quiz). Generated number categories are ordinary
 *     drill facts and need no mode exception.
 *   - `length` → "limited" + `limType` "cov" (full coverage of the lesson set).
 *   - `ask`    → left ALONE, and this is now SAFE. `ask` is derived from the
 *     single `audioPrompts` toggle (askFromAudioPrompts), and TEXT IS ALWAYS ON,
 *     so the ask always carries every response and a text prompt — a
 *     full-coverage drill reaches every taught form, grammar PRODUCTION included.
 *     Whether audio is ALSO on is environmental (does the learner have a TTS
 *     voice?), not the lesson's to dictate, so it stays live. The old audio-only
 *     option — which could drop production and leave a lesson asking 0 cards —
 *     is gone, so "always the full set" is now actually true.
 *
 * Only `origin === "lesson"` is forced. A Library slice ("library") is a
 * practice run and keeps honouring the settings; a one-off quiz (undefined
 * origin) never reaches this path.
 */
export function forLessonOrigin(
  snap: QuizSnapshot,
  origin: SessionOrigin | undefined,
): QuizSnapshot {
  if (origin !== "lesson") return snap;
  return {
    ...snap,
    mode: snap.mode === "assembly" ? "assembly" : "drill",
    length: "limited",
    limType: "cov",
  };
}

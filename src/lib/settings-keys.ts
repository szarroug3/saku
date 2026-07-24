// Every app-owned localStorage key, in one place, with its new `saku-*` name, its
// legacy `kanaquiz-*` name, and the sentinel string values a few of them store.
//
// WHY A KEYS MODULE
// =================
// Two needs meet here. First, the rename from `kanaquiz-*` to `saku-*` touches a
// dozen modules, and a single source for both the new and old name of each key is
// what lets every read site migrate the legacy value forward (see storage-migrate)
// without each module re-deriving the old string. Second, the settings-sync layer
// (settings-local.ts) has to map the whole set of individual keys to and from the
// server settings blob — and if it imported the React providers that own those
// keys (theme.tsx, quiz-config.tsx) it would form an import cycle through
// use-settings → settings-provider → settings-local. A plain, dependency-free
// keys module breaks that cycle: the providers and the sync layer both import
// from here, and here imports nothing.
//
// This module is intentionally free of React, `window`, and `server-only`, so it
// is safe to import from any layer, including plain-Node tests.

// ---------- theme (src/lib/theme.tsx) ----------
export const THEME_KEY = "saku-theme";
export const APPEARANCE_KEY = "saku-appearance";
export const ACCENTS_KEY = "saku-accents";
export const OLD_THEME_KEY = "kanaquiz-theme";
export const OLD_APPEARANCE_KEY = "kanaquiz-appearance";
export const OLD_ACCENTS_KEY = "kanaquiz-accents";

// ---------- quiz config (src/lib/quiz-config.tsx) ----------
export const CFG_KEY = "saku-cfg";
export const OLD_CFG_KEY = "kanaquiz-cfg";

// ---------- claim explainer dismissal (src/lib/claim-hint.ts) ----------
export const CLAIM_HINT_KEY = "saku-claim-hint";
export const OLD_CLAIM_HINT_KEY = "kanaquiz-claim-hint";
/** The stored value meaning "dismissed"; anything else reads as "still show it". */
export const CLAIM_HINT_DISMISSED = "dismissed";

// ---------- lesson section preferences (src/lib/lesson-prefs.ts) ----------
export const LESSON_WRITING_KEY = "saku-lesson-writing";
export const LESSON_READINGS_KEY = "saku-lesson-readings";
export const OLD_LESSON_WRITING_KEY = "kanaquiz-lesson-writing";
export const OLD_LESSON_READINGS_KEY = "kanaquiz-lesson-readings";
/** The stored value meaning "this section opens by default"; absent means closed. */
export const LESSON_OPEN = "1";

// ---------- latency baseline (src/lib/latency-store.ts) ----------
export const LATENCY_KEY = "saku-latency";
export const OLD_LATENCY_KEY = "kanaquiz-latency";

// ---------- once-ever concept-card intros (src/lib/intro-shown.ts) ----------
/** The localStorage key for one intro's "already shown" flag. */
export function introShownKey(id: string): string {
  return `saku-intro-${id}`;
}
/** The legacy key for the same flag, for the one-time migration. */
export function oldIntroShownKey(id: string): string {
  return `kanaquiz-intro-${id}`;
}
/** The stored value meaning "shown"; anything else reads as "still owed". */
export const INTRO_SHOWN = "shown";

// ---------- quiz session snapshot (src/lib/quiz-session.tsx) ----------
export const SESSION_KEY = "saku-session";
export const OLD_SESSION_KEY = "kanaquiz-session";

// ---------- in-progress session SYNC metadata (src/lib/quiz-session.tsx) ----------
// The device's own view of the synced run: its stable id and the ms timestamp of
// this device's last in-progress write. Separate from the SESSION_KEY snapshot
// (which is the subject of the delicate cross-tab adoption protocol and must not
// grow a per-write timestamp that would defeat its idempotence guard). Used to
// build the last-writer-wins envelope on load. New in Sync Part 2 — no legacy
// name to migrate. See src/lib/session-state.ts.
export const SESSION_SYNC_KEY = "saku-session-sync";

// ---------- unsent-record outbox (src/lib/pending-records.ts) ----------
export const PENDING_KEY = "saku-pending-records";
export const OLD_PENDING_KEY = "kanaquiz-pending-records";

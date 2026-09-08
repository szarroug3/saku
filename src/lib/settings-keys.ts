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
// server settings blob, and if it imported the React provider that owns one of
// those keys (quiz-config.tsx) it would form an import cycle through
// use-settings → settings-provider → settings-local. A plain, dependency-free
// keys module breaks that cycle: the provider and the sync layer both import
// from here, and here imports nothing.
//
// This module is intentionally free of React, `window`, and `server-only`, so it
// is safe to import from any layer, including plain-Node tests.

// ---------- quiz config (src/lib/quiz-config.tsx) ----------
export const CFG_KEY = "saku-cfg";
export const OLD_CFG_KEY = "kanaquiz-cfg";

// Practice's saved recipes and its own misses (SAK-342). The Sky's practice
// page reads and writes these two keys directly (src/app/dev/sky/practice-client.tsx)
// and pushes them up as the `practice` field of the settings blob.
export const PRACTICE_SAVED_KEY = "sky:practice:recipes";
export const PRACTICE_MISSES_KEY = "sky:practice:misses";

// ---------- unsent-record outbox (src/lib/pending-records.ts) ----------
export const PENDING_KEY = "saku-pending-records";
export const OLD_PENDING_KEY = "kanaquiz-pending-records";

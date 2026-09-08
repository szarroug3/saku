// Every app-owned storage key a live module reads or writes, in one place.
//
// WHY A KEYS MODULE
// =================
// The settings-sync layer (settings-local.ts) maps the individual keys to and
// from the server settings blob, and if it imported the React provider that owns
// one of them (quiz-config.tsx) it would form an import cycle through
// use-settings → settings-provider → settings-local. A plain, dependency-free
// keys module breaks that cycle: the provider and the sync layer both import
// from here, and here imports nothing.
//
// It used to carry each key's legacy `kanaquiz-*` name too, for the rename shim
// that copied a value forward on first read. The shim went in SAK-378, along
// with every key here that named a feature the Sky does not have. What was left
// behind in a learner's browser is swept by storage-sweep.ts, which holds the
// dead names rather than this file.
//
// This module is intentionally free of React, `window`, and `server-only`, so it
// is safe to import from any layer, including plain-Node tests.

// ---------- quiz config (src/lib/quiz-config.tsx) ----------
export const CFG_KEY = "saku-cfg";

// Practice's saved recipes and its own misses (SAK-342). The Sky's practice
// page reads and writes these two keys directly (src/app/(sky)/practice-client.tsx)
// and pushes them up as the `practice` field of the settings blob.
export const PRACTICE_SAVED_KEY = "sky:practice:recipes";
export const PRACTICE_MISSES_KEY = "sky:practice:misses";

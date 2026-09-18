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

// Practice's saved recipes (SAK-342). The Sky's practice page reads and writes
// this key directly (src/app/(sky)/practice-client.tsx) and pushes it up as the
// `practice` field of the settings blob. There was a second key beside it,
// practice's own count of what had been missed; practice records now (SAK-441),
// so the history answers that and the key is swept (lib/storage-sweep.ts).
export const PRACTICE_SAVED_KEY = "sky:practice:recipes";

// The reference pages a lesson has already shown this learner (SAK-467). The
// Sky's lesson reads and writes this key directly
// (src/app/(sky)/pages-seen.ts) and pushes it up as the `pagesSeen` field of
// the settings blob, exactly the way Practice's recipes go up.
export const PAGES_SEEN_KEY = "sky:lesson:pages-seen";

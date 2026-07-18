// The pure brand-restoring key helpers, split OUT of src/lib/facts.ts.
//
// WHY THIS IS ITS OWN FILE
// ========================
// `factKeys`/`entryKeys` are `Object.keys()` with the brand cast back on — they
// touch NO subject data. But they used to live in facts.ts, which top-level
// imports every subject's registry (KANA/KANJI/VOCAB/GRAMMAR facts), and an
// ES module import pulls the WHOLE module in: any file that reached for
// `factKeys` alone — session.ts, the results math, the always-mounted
// QuizSessionProvider — dragged the entire ~3.6 MB vocab+kanji payload into the
// eager client bundle, on every route, just to call `Object.keys`.
//
// Splitting these two casts into a data-free module cuts that edge. Modules that
// only restore key brands import from HERE and stay light; facts.ts re-exports
// them so the registry-owning call sites are unchanged. This changes no
// behaviour — the functions are byte-for-byte the same.

import type { EntryId, FactId } from "@/types";

/**
 * A SessionStats / history.facts key list, with the brand restored.
 *
 * `Object.keys` on a `Record<FactId, …>` returns `string[]` — a mapped type
 * over a non-literal string widens to a plain string index signature and the
 * brand is erased. This is the one sanctioned place to put it back, so that
 * the cast is spelled once here instead of scattered across every walk.
 */
export function factKeys(record: object): FactId[] {
  return Object.keys(record) as FactId[];
}

/** As `factKeys`, for a `Record<EntryId, …>` — `confused`, in practice. */
export function entryKeys(record: object): EntryId[] {
  return Object.keys(record) as EntryId[];
}

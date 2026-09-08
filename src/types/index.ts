// The app's shared types, in three files since SAK-407.
//
//   facts.ts — the identities everything is keyed by (EntryId, FactId) and
//              what a consumer may know about a fact. Depends on nothing.
//   sky.ts   — the Sky's own shapes: characters, the quiz config and how to
//              ask, a selection, one run's stats while it runs.
//   store.ts — the shapes that are written to and read from a learner's
//              `progress` row: the history document, the per-fact aggregate,
//              a session record, the settings blob.
//
// The split is what the file was asking for at 923 lines: the durable half and
// the in-flight half had nothing to do with each other and sat interleaved.
// `@/types` stays the one import surface, so no call site changed — 194 files
// import it and 135 name a stored type, and rewriting all of them is a
// separate change from splitting the file.

export type * from "./facts";
export type * from "./sky";
export type * from "./store";

// The unified content model — one shape for lessons, quizzes, and the library.
//
// Stage 0 of docs/architecture-refactor.md: additive scaffolding, not yet
// consumed. Stages 1–4 move each track onto these types one at a time, deleting a
// fork with each move. Import from "@/lib/content".

export type { FactKind, Fact } from "./fact";
export type { ContentKind, ContentItem } from "./item";
export type { Track } from "./track";
export type { Lesson, NextLesson } from "./scheduler";
export { MAX_PREREQ_DEPTH } from "./scheduler";
export type { Registry, ItemRenderer } from "./registry";
export { createRegistry, itemRenderers } from "./registry";

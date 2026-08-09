// The unified content model — one shape for lessons, quizzes, and the library.
//
// Stage 0 of docs/architecture-refactor.md: additive scaffolding, not yet
// consumed. Stages 1–4 move each track onto these types one at a time, deleting a
// fork with each move. Import from "@/lib/content".

export type { FactKind, Fact } from "./fact";
export type { ContentKind, ContentItem } from "./item";
export type { Track } from "./track";
export type { Registry, ItemRenderer, FactRenderer } from "./registry";
export { createRegistry, itemRenderers, factRenderers } from "./registry";

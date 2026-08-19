// The MINIMAL shape the Learn next-lesson preview renders — glyph, type label, and
// the kind (only the sentence-ordering watermark reads it). Both the live
// `ContentItem`/`TeachingUnit` and the precomputed `IndexItem`/`IndexUnit` satisfy
// it, so the preview cards render either without importing a content module.

import type { EntryId, FactId } from "@/types";

/** What ItemPreview renders. */
export interface PreviewItem {
  readonly entry: EntryId;
  readonly glyph: string;
  readonly typeLabel: string;
  readonly kind: string;
}

/** One unit of a previewed lesson — its item and the facts it teaches. */
export interface PreviewUnit {
  readonly item: PreviewItem;
  readonly facts: readonly FactId[];
}

/** A lesson as the preview card consumes it. */
export interface PreviewLesson {
  readonly units: readonly PreviewUnit[];
}

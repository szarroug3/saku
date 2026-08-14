// LIBRARY INDEX — the serialized shape of the precomputed Library list/search
// index (src/data/generated/library-index.json). Carries only what the Library
// LIST page, search, and shelf grouping need — the same fields `LibEntry`
// already exposed (glyph, readings, meanings, sub, weight) plus small structural
// lookups (known facts, fact→entry, the kind list, sentence tier ids/labels).
// Never a definition, an etymology, or anything a detail page alone needs — those
// stay on the live derivation in library/entries.ts, read only by entry detail
// routes, which this index deliberately does not touch.

import type { EntryId, FactId } from "@/types";
import type { LibEntry } from "@/lib/library/entries";

/** The precomputed record is `LibEntry` itself (type-only import — zero runtime
 * cost) so it is interchangeable with the live type wherever code (search.ts's
 * match functions, etc.) is typed against `LibEntry`. The build script only
 * ever populates the search/list fields `LibEntry` already has; it emits
 * nothing detail-only. */
export type IndexLibEntry = LibEntry;

/** One sentence-ordering tier's id/label — enough to list a shelf row; the full
 * `AssemblyTier` (patterns, gates) stays content-only, lazy-loaded by whatever
 * needs to actually schedule or drill it. */
export interface IndexSentenceTier {
  readonly id: string;
  readonly label: string;
}

export interface LibraryIndex {
  readonly libraryIndexVersion: string;
  readonly kinds: readonly string[];
  readonly kindLabel: Readonly<Record<string, string>>;
  readonly entries: readonly IndexLibEntry[];
  /** Entry id -> the fact ids that count as "known" for it (knownFactsOf's
   * output, serialized — not re-derived). */
  readonly knownFacts: Readonly<Record<string, readonly FactId[]>>;
  /** Fact id -> its entry id (entryOf's output for every fact in the app). */
  readonly factEntry: Readonly<Record<string, EntryId>>;
  /** Entry id -> every one of its facts (factsOf's output, unfiltered — unlike
   * knownFacts, which applies knownFactsOf's per-kind "known" filtering). */
  readonly entryFacts: Readonly<Record<string, readonly FactId[]>>;
  readonly sentenceTiers: readonly IndexSentenceTier[];
  /** Every glyph with a KANJIDIC2 row — existence only, for entryForGlyph. */
  readonly kanjiGlyphs: readonly string[];
  /** Glyph -> jōyō school grade. */
  readonly kanjiGrade: Readonly<Record<string, number>>;
  /** The three fixed kanji teach orders (kanjiTeachOrder's output, serialized —
   * "read it, never re-derive it" per its own doc). */
  readonly kanjiTeachOrders: {
    readonly everyday: readonly string[];
    readonly grade: readonly string[];
    readonly newspaper: readonly string[];
  };
  /** Every grammar-concept slug (GRAMMAR_CONCEPTS' `id`s), in order. */
  readonly grammarConceptIds: readonly string[];
  /** Form -> display label (lib/grammar/formula.ts's `FORM_LABEL`). */
  readonly formLabel: Readonly<Record<string, string>>;
  /** Recipe ids in grammar teaching order (grammar-order.ts's
   * `GRAMMAR_TEACHING_ORDER`, ids only). */
  readonly grammarTeachingOrderIds: readonly string[];
}

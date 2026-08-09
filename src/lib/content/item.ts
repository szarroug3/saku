// The unified CONTENT ITEM — the one thing lessons, quizzes, and the library all
// consume, so a new content type (or a new word) renders everywhere by being an
// item, not by getting its own forked stack.
//
// Stage 0 of docs/architecture-refactor.md: additive, not yet consumed.

import type { EntryId } from "@/types";
import type { RoleName } from "@/lib/character-role";
import type { Fact } from "./fact";

/**
 * The content kinds the app teaches. NUMBERS are first-class here — a word whose
 * role is number — not a kanji special-cased at each call site (which is how they
 * lost their reading and got labelled "Kanji · Word"). "generative-rule" is a
 * range/counter drill unit ("read 11–99"); it is an item like any other, so the
 * shared viewport renders it without a bespoke component.
 */
export type ContentKind =
  | "word"
  | "kanji"
  | "kana"
  | "counter"
  | "number"
  | "grammar"
  | "generative-rule";

/**
 * One teachable/quizzable item. Its `facts` follow from its `kind` via the single
 * expander `factsOf` (Stage 1), sourced from the dictionary — so adding a word is
 * adding a row, and its meaning/reading/… facts come by construction rather than
 * being stitched per track. `roles` reuses the existing central labeller
 * (character-role.ts); nothing re-phrases a role at a call site.
 */
export interface ContentItem {
  readonly entry: EntryId;
  readonly kind: ContentKind;
  readonly glyph: string;
  readonly facts: readonly Fact[];
  readonly roles: readonly RoleName[];
}

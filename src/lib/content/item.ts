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
 *
 * PREREQUISITES ARE DATA ON THE ITEM, not per-track scheduler logic. `prereqs`
 * lists the items this one is built on — a number kanji, a component radical, a
 * word a counter needs. The one scheduler (see track.ts) resolves them
 * transitively and ACROSS tracks: a number may pull a non-number kanji that
 * "belongs" to the word track, and the scheduler teaches it here regardless. The
 * DAG they form is the whole prerequisite graph; the scheduler walks it, budgets
 * it, and depth-gates it — no track re-implements any of that.
 */
export interface ContentItem {
  readonly entry: EntryId;
  readonly kind: ContentKind;
  readonly glyph: string;
  readonly facts: readonly Fact[];
  readonly roles: readonly RoleName[];
  /** The items this one is directly built on (its edges in the prereq DAG). May
   * point at items in ANY track; the scheduler follows them wherever they live. */
  readonly prereqs: readonly EntryId[];
}

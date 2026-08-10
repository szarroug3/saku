// The unified CONTENT ITEM — the one thing lessons, quizzes, and the library all
// consume, so a new content type (or a new word) renders everywhere by being an
// item, not by getting its own forked stack.
//
// Stage 0 of docs/architecture-refactor.md: additive, not yet consumed.

import type { EntryId } from "@/types";
import type { RoleName } from "@/lib/character-role";
import type { KanjiEtymology } from "@/data/kanji-etymology";
import type { Fact } from "./fact";

/**
 * The content kinds the app teaches.
 *
 * "character" is a SINGLE Han glyph taught as ONE cohesive item across every role
 * it plays — radical AND kanji AND number/word (三 is the character three, the
 * kanji three, and the number さん, all one lesson). It carries the UNION of its
 * roles' facts and is labelled by `characterRoles`; a glyph is never split into a
 * kanji item and a number item that teach 三 twice. This mirrors the words/kanji
 * curriculum spine, where a glyph is one item with a roles set.
 *
 * "word" is a MULTI-character word (先生); "counter" a counter form (〜つ, 二十歳);
 * "generative-rule" a range/counter drill unit ("read 11-99"), an item like any
 * other so the shared viewport renders it without a bespoke component.
 */
export type ContentKind =
  | "character"
  | "word"
  | "kana"
  | "counter"
  | "generative-rule"
  // Tracks not yet migrated to the model — named here so views can be designed
  // against the full set; they have no buildItem path yet.
  | "keigo"
  | "grammar"
  | "transitivity"
  | "sentence-ordering";

/**
 * One teachable/quizzable item. Its `facts` follow from its `kind` via the single
 * expander `factsOf` (Stage 1), sourced from the dictionary — so adding a word is
 * adding a row, and its meaning/reading/… facts come by construction rather than
 * being stitched per track. `roles` reuses the existing central labeller
 * (character-role.ts); nothing re-phrases a role at a call site.
 *
 * PREREQUISITES ARE DATA ON THE ITEM, not per-track scheduler logic, and come in
 * two kinds:
 *   - `prereqs` are TEACHING prerequisites — the things this one is built ON (a
 *     component radical, a kanji a word is written with). The scheduler PULLS them
 *     in AHEAD of the item and teaches them in the same flow, resolving them
 *     transitively and ACROSS tracks: a number may pull a word-track kanji, and it
 *     is taught here regardless.
 *   - `blockedBy` are BLOCKING prerequisites — things that must already be learned
 *     ELSEWHERE before this item is worth teaching, and that are NEVER pulled in.
 *     A transitivity pair is blocked by its two verbs: there is no point teaching
 *     which of 開く/開ける is transitive before you know the verbs, and a verb too
 *     rare to be taught should keep its pair out of the deck entirely. The
 *     scheduler defers a blocked item and, if the block never lifts, never teaches
 *     it.
 * The teaching edges form the prereq DAG; the scheduler walks, budgets, and
 * depth-gates it — no track re-implements any of that.
 */
export interface ContentItem {
  readonly entry: EntryId;
  readonly kind: ContentKind;
  readonly glyph: string;
  readonly facts: readonly Fact[];
  readonly roles: readonly RoleName[];
  /** TEACHING prerequisites — the items this one is built on (its edges in the
   * prereq DAG). Pulled in and taught AHEAD of this item; may point at items in
   * ANY track, and the scheduler follows them wherever they live. */
  readonly prereqs: readonly EntryId[];
  /** BLOCKING prerequisites — items that must already be learned before this one
   * is taught, and are NEVER pulled in (a transitivity pair's two verbs). The
   * scheduler defers this item until every one is learned; if the block never
   * lifts, it is never taught. Empty for everything with no cross-track gate. */
  readonly blockedBy: readonly EntryId[];
  /** The glyph's origin story — a precomputed lookup (etymologyOf), attached
   * because it EXPLAINS the `prereqs` (the components it is built from). Null for
   * a glyph with no etymology (suppressed, or not a kanji). Display-only; not a
   * fact, not a scheduling input. */
  readonly etymology: KanjiEtymology | null;
  /** What KIND of thing this is, for display — a character's roles
   * ("radical · kanji · word"), else a per-kind label. Computed ONCE at build
   * (`contentTypeLabel`); views read it, they don't recompute it. */
  readonly typeLabel: string;
}

/** The display type of an item: a character shows the roles it plays; other kinds
 * show what they are. Called once per item at build time — the result is stored
 * on `ContentItem.typeLabel`. */
export function contentTypeLabel(kind: ContentKind, roles: readonly RoleName[]): string {
  switch (kind) {
    case "character":
      return roles.join(" · ");
    case "generative-rule":
      return "counting rule";
    case "grammar":
      return "grammar rule";
    case "transitivity":
      return "verb pair";
    case "sentence-ordering":
      return "building sentences";
    default:
      return kind; // word · counter · kana · keigo
  }
}

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
      return "sentence order";
    default:
      return kind; // word · counter · kana · keigo
  }
}

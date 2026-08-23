// SAK-104: `Kind`, `KINDS` and `KIND_LABEL` also live on
// src/lib/library/entries.ts (and are re-exported from the now server-only
// library-index.ts) — this is a byte-identical, literal-only duplicate for the
// handful of client components that need just the shelf/tab enumeration and
// its labels, not the entry data. entries.ts imports @/data/vocab (heavy,
// server-only) purely to build LibEntry objects, so importing it from a
// client file — even just for these two small constants — would drag the
// whole guarded dependency chain along. These are plain string literals with
// no data dependency of their own, so they are safe to duplicate here rather
// than fetch through a Server Action. See shelves.tsx's own header for the
// same reasoning applied to three of these values earlier.
//
// KEEP THIS IN SYNC with entries.ts's KINDS/KIND_LABEL — a new subject added
// there needs the same line added here.

export const KANA_KIND = "kana";
export const RADICAL_KIND = "radical";
export const KANJI_KIND = "kanji";
export const VOCAB_KIND = "word";
export const COUNTER_KIND = "counting";
export const GRAMMAR_KIND = "grammar";
export const GRAMMAR_CONCEPT_KIND = "grammar-concept";
export const TRANSITIVITY_KIND = "transitivity";
export const KEIGO_KIND = "keigo";
export const SENTENCE_RULE_KIND = "sentence-rule";
export const MARK_KIND = "writing-rule";
export const TERM_KIND = "term";
export const PRIMITIVE_KIND = "primitive";
/** A construction page's own kind — deliberately NOT in KINDS below (no shelf
 * chip of its own, its pages live on the Counting shelf — see entries.ts's
 * own KIND_LABEL comment), but still a real value entries/breadcrumbs carry,
 * so it has to be part of the `Kind` union here too. */
export const NUMBER_CONSTRUCTION_KIND = "numbers";

export type Kind =
  | typeof KANA_KIND
  | typeof MARK_KIND
  | typeof RADICAL_KIND
  | typeof KANJI_KIND
  | typeof VOCAB_KIND
  | typeof COUNTER_KIND
  | typeof GRAMMAR_KIND
  | typeof GRAMMAR_CONCEPT_KIND
  | typeof TRANSITIVITY_KIND
  | typeof KEIGO_KIND
  | typeof SENTENCE_RULE_KIND
  | typeof TERM_KIND
  | typeof PRIMITIVE_KIND
  | typeof NUMBER_CONSTRUCTION_KIND;

/** Browse/teaching order — see entries.ts's KINDS for the reasoning behind
 * this exact order, unchanged here. */
export const KINDS: readonly Kind[] = [
  KANA_KIND,
  RADICAL_KIND,
  KANJI_KIND,
  VOCAB_KIND,
  COUNTER_KIND,
  GRAMMAR_KIND,
  GRAMMAR_CONCEPT_KIND,
  TRANSITIVITY_KIND,
  KEIGO_KIND,
  SENTENCE_RULE_KIND,
  MARK_KIND,
  TERM_KIND,
  PRIMITIVE_KIND,
];

export const KIND_LABEL: Record<Kind, string> = {
  [KANA_KIND]: "Kana",
  [MARK_KIND]: "Writing rules",
  [RADICAL_KIND]: "Radicals",
  [KANJI_KIND]: "Kanji",
  [VOCAB_KIND]: "Words",
  [COUNTER_KIND]: "Counting",
  [NUMBER_CONSTRUCTION_KIND]: "Counting",
  [SENTENCE_RULE_KIND]: "Sentence rules",
  [GRAMMAR_KIND]: "Grammar",
  [GRAMMAR_CONCEPT_KIND]: "Grammar concepts",
  [TRANSITIVITY_KIND]: "Verb pairs",
  [KEIGO_KIND]: "Keigo",
  [TERM_KIND]: "Terms",
  [PRIMITIVE_KIND]: "Kanji parts",
};

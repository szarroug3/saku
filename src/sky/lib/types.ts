// The Sky redesign's own item model. Deliberately NOT the app's `ContentItem` — this
// tree owns its types so the old content model can be deleted without touching
// anything in here. See src/sky/README.md.

import type { Standing } from "./standing";

/**
 * What kind of thing this is. Drives the section an item belongs to and which
 * lesson blocks a detail panel renders.
 *
 * `verbPair` and `keigo` are their own kinds rather than attributes of a word.
 * They used to ride along with a headword, so picking "to open something"
 * silently dragged its partner in, which made one card's real cost depend on
 * grammar the learner could not see. They now unlock as their own sections and
 * are picked deliberately, like anything else.
 */
export type SkyKind =
  | "kana"
  | "radical"
  | "kanji"
  | "word"
  | "counter"
  | "grammar"
  /** A sentence rule: how a kind of sentence is ordered. Its own kind, not
   * grammar (Sam's call, 2026-09-05). */
  | "sentence"
  /** A term: a name and its definition, the reference pages the tracks
   * open with. Never a star; a page to read. */
  | "term"
  /** A writing rule: dakuten, the small tsu, long vowels, punctuation.
   * A page to read, like a term. */
  | "mark"
  /** A grammar concept: verb types, adjective types, the keigo registers.
   * A page to read, like a term. */
  | "concept"
  | "verbPair"
  | "keigo";

/** The kinds that are pages to read, never asked about: nothing to pick,
 * claim or quiz, and no standing to show. */
export const PAGE_KINDS: ReadonlySet<SkyKind> = new Set<SkyKind>(["term", "mark", "concept"]);

export function isPage(kind: SkyKind): boolean {
  return PAGE_KINDS.has(kind);
}


/**
 * One item, in the shape every Sky surface consumes.
 *
 * `english` is separate from `glyph` on purpose: the Planetarium shows English only
 * (you pick what to learn before you can read it), while the Atlas leads with
 * the glyph. One card serves both by choosing which is the foreground.
 */
export interface SkyItem {
  id: string;
  kind: SkyKind;
  /**
   * The Japanese. Also the ghost drawn behind an ItemCard.
   *
   * For a kana row this is the row's representative character (か for the K
   * row), since the row itself has no single glyph but still wants texture in
   * the corner.
   */
  glyph: string;
  /**
   * What the Planetarium shows in the foreground, in English.
   *
   * For most kinds this is the meaning. For a kana row it is the row's name
   * ("Vowels", "K row"), because romaji strung together ("ka ki ku ke ko")
   * reads as a password rather than as a thing you could choose to learn.
   */
  english: string;
  /** Reading, when the item has one unambiguous one. Kana, not romaji. */
  reading?: string;
  /** Its parts are its content and the card lists them itself (the 〜つ
   * rule's ten forms), so the card shows no "Made of". */
  listsParts?: boolean;
  /** The radicals a kanji is built from, for looking a kanji up by what
   * can be seen in it (SAK-325). Only on a kanji tile. */
  parts?: readonly string[];
  /** How it is going, in the app's own words (SAK-294): the six standings of
   * src/sky/lib/standing.ts. Painted only beside a legend or as a chip. */
  standing: Standing;
  /**
   * IDs of the items this one is built from, if any — a word's kanji, a
   * kanji's radicals. Absent or empty for something with no parts (most
   * radicals, kana). Deliberately named for the relationship, not the kinds
   * involved, so the same field composes a word from kanji today and
   * whatever the sky adds next, without renaming.
   */
  components?: string[];
  /**
   * How many things a quiz could ask about it, when the adapter knows: one
   * for a kana, several for a grammar pattern. A surface offers a quiz only
   * when there is more than one. Optional: most skies never ask.
   */
  quizzable?: number;
  /**
   * A grouping of its components rather than a thing learned on its own: a
   * kana row. It is picked as one, locks what builds on it, and is drawn,
   * but it is never a piece: the row costs its sounds, not its sounds plus
   * one. Absent (false) for everything that is itself learned.
   */
  group?: boolean;
  /**
   * For a verb pair or a keigo form: the word it attaches to. A prerequisite
   * too (you meet the pair after its headword), on top of the pair's own
   * kanji, which may be entirely different from the headword's. Ignored on
   * every other kind. See src/sky/lib/graph.ts.
   */
  headword?: string;
}

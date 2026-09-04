// The Sky redesign's own item model. Deliberately NOT the app's `ContentItem` — this
// tree owns its types so the old content model can be deleted without touching
// anything in here. See src/sky/README.md.

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
  | "verbPair"
  | "keigo";

/**
 * How far the learner has got with one item. Four values, shared by every Sky
 * surface, so a colour means the same thing in the sky, the Atlas, the
 * Planetarium and Practice.
 *
 * - `mastered` graduated out of the review basket for good, still on the tree
 * - `learned`  opened and known, eligible for the basket
 * - `planted`  on your tree, bud not opened yet
 * - `wild`     exists in Saku, never planted
 */
export type SkyStatus = "mastered" | "learned" | "planted" | "wild";

/** True once the learner has actually opened and learned the item. */
export function isKnown(status: SkyStatus): boolean {
  return status === "mastered" || status === "learned";
}

/** True when the item sits on the learner's tree at all, opened or not. */
export function isOnTree(status: SkyStatus): boolean {
  return status !== "wild";
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
  status: SkyStatus;
  /**
   * IDs of the items this one is built from, if any — a word's kanji, a
   * kanji's radicals. Absent or empty for something with no parts (most
   * radicals, kana). Deliberately named for the relationship, not the kinds
   * involved, so the same field composes a word from kanji today and
   * whatever the sky adds next, without renaming.
   */
  components?: string[];
}

// The Grove's own item model. Deliberately NOT the app's `ContentItem` — this
// tree owns its types so the old content model can be deleted without touching
// anything in here. See src/grove/README.md.

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
export type GroveKind =
  | "kana"
  | "radical"
  | "kanji"
  | "word"
  | "counter"
  | "grammar"
  | "verbPair"
  | "keigo";

/**
 * How far the learner has got with one item. Four values, shared by every Grove
 * surface, so a colour means the same thing in the Garden, the Library, the
 * Nursery and Practice.
 *
 * - `mastered` graduated out of the review basket for good, still on the tree
 * - `learned`  opened and known, eligible for the basket
 * - `planted`  on your tree, bud not opened yet
 * - `wild`     exists in Saku, never planted
 */
export type GroveStatus = "mastered" | "learned" | "planted" | "wild";

/** True once the learner has actually opened and learned the item. */
export function isKnown(status: GroveStatus): boolean {
  return status === "mastered" || status === "learned";
}

/** True when the item sits on the learner's tree at all, opened or not. */
export function isOnTree(status: GroveStatus): boolean {
  return status !== "wild";
}

/**
 * One item, in the shape every Grove surface consumes.
 *
 * `english` is separate from `glyph` on purpose: the Nursery shows English only
 * (you pick what to learn before you can read it), while the Library leads with
 * the glyph. One card serves both by choosing which is the foreground.
 */
export interface GroveItem {
  id: string;
  kind: GroveKind;
  /**
   * The Japanese. Also the ghost drawn behind an ItemCard.
   *
   * For a kana row this is the row's representative character (か for the K
   * row), since the row itself has no single glyph but still wants texture in
   * the corner.
   */
  glyph: string;
  /**
   * What the Nursery shows in the foreground, in English.
   *
   * For most kinds this is the meaning. For a kana row it is the row's name
   * ("Vowels", "K row"), because romaji strung together ("ka ki ku ke ko")
   * reads as a password rather than as a thing you could choose to learn.
   */
  english: string;
  /** Reading, when the item has one unambiguous one. Kana, not romaji. */
  reading?: string;
  status: GroveStatus;
}

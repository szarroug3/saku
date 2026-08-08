// A rare, UNTAUGHT phonetic component's reading and meaning — the lookup the
// Built-from box uses to flag a sound piece the learner has never met.
//
// SOME PHONETIC PIECES ARE NOT CHARACTERS WE TEACH. 講 is 言 + 冓, and 冓 (こう,
// "a framework of crossed timbers") is a rare component with no dictionary entry
// of its own. Shown as a bare glyph on a tile, it reads as a character the learner
// should recognise and does not — so the box flags it with an asterisk and a
// plain-language footnote instead. The trigger AND the copy come from this lookup:
// a non-null result means "this is one of those rare untaught components".
//
// THE REAL LOOKUP LANDS WITH THE DATA LAYER. `phoneticGloss` is owned by
// src/data/kanji-etymology.ts on feat/kanji-etymology; until that merges in, this
// is a placeholder that returns null, so every phonetic piece renders as a plain
// tile and nothing breaks. On merge, delegate the body to the data-layer lookup
// (or re-point the import) — the interface here is the contract both sides hold.

/** A rare untaught phonetic component's reading (kana, null when it could not be
 * derived) and its rough meaning. */
export interface PhoneticGloss {
  readonly reading: string | null;
  readonly meaning: string;
}

/**
 * The reading + meaning of a rare, untaught phonetic component (冓, 咅, …), or
 * null for a component we DO teach (可, 交, 寺 — jōyō, met on its own card) and
 * for anything that is not a flagged rare component. Non-null is the Built-from
 * box's signal to draw the asterisk and print the footnote.
 *
 * PLACEHOLDER: returns null until feat/kanji-etymology's `phoneticGloss` merges
 * in. See the file header.
 */
export function phoneticGloss(glyph: string): PhoneticGloss | null {
  void glyph;
  return null;
}

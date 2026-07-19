// A kana's family — the other characters built out of the same shape.
//
// き is not an island. It has a katakana twin (キ), a voiced form (ぎ), and three
// combos (きゃ きゅ きょ), and every one of those is a SEPARATE ENTRY with its own
// page and its own score. That last part is the whole reason this module is
// careful: the family section is a set of POINTERS, and the one thing it must
// never do is print ぎ's reading beside き's, because a reader comparing "ki" and
// "gi" in one table is being shown two entries as if they were one.
//
// DERIVED, NOT LISTED
// ===================
// Every relation here falls out of Unicode, so there is no table to keep in sync
// with characters.ts:
//
//   voiced / half-voiced  — NFD decomposition. ぎ decomposes to き + U+3099
//                           (combining dakuten), ぱ to は + U+309A. So "is this
//                           a voiced form of that" is a string comparison on the
//                           decomposition, not a k→g romaji table that would
//                           have to enumerate every row.
//   katakana twin         — a fixed +0x60 codepoint offset across the two
//                           contiguous blocks. き U+304D → キ U+30AD.
//   combos                — a two-character glyph whose FIRST character is the
//                           base. きゃ starts with き.
//
// Everything is then filtered through CHAR_INDEX, so a derivation that produces
// a character the app does not actually teach yields nothing rather than a
// broken link.

import { CHAR_INDEX, kanaEntry } from "@/data/characters";
import type { EntryId } from "@/types";

const HIRAGANA_START = 0x3041;
const HIRAGANA_END = 0x309f;
const KATAKANA_OFFSET = 0x60;

/** The combining marks NFD leaves behind. */
const DAKUTEN = "゙";
const HANDAKUTEN = "゚";

/** One relation, named for what it IS rather than for the mark that makes it.
 * "Voiced" is a word the app can use; "dakuten" is the name of the mark and
 * lives on its own Writing-rules page. */
export interface FamilyCell {
  /** What the group is called on screen. */
  readonly title: string;
  readonly members: readonly { readonly glyph: string; readonly entry: EntryId }[];
}

function isHiragana(ch: string): boolean {
  const cp = ch.codePointAt(0);
  return cp !== undefined && cp >= HIRAGANA_START && cp <= HIRAGANA_END;
}

/** The katakana written for the same sound, when the app teaches it. */
function twinOf(glyph: string): string | null {
  if (glyph.length !== 1 || !isHiragana(glyph)) return null;
  const twin = String.fromCodePoint((glyph.codePointAt(0) as number) + KATAKANA_OFFSET);
  return CHAR_INDEX[twin] ? twin : null;
}

/** Every taught kana whose NFD decomposition is this glyph plus `mark`. */
function markedForms(glyph: string, mark: string): string[] {
  const out: string[] = [];
  for (const c of Object.keys(CHAR_INDEX)) {
    if (c.length !== 1) continue;
    const nfd = c.normalize("NFD");
    if (nfd.length === 2 && nfd[0] === glyph && nfd[1] === mark) out.push(c);
  }
  return out;
}

/** Every taught combo starting with this glyph — きゃ きゅ きょ. */
function combosOf(glyph: string): string[] {
  return Object.keys(CHAR_INDEX).filter((c) => c.length > 1 && c.startsWith(glyph));
}

function cell(title: string, glyphs: readonly string[]): FamilyCell | null {
  const members = glyphs
    .filter((g) => CHAR_INDEX[g])
    .map((g) => ({ glyph: g, entry: kanaEntry(g) }));
  return members.length ? { title, members } : null;
}

/**
 * The family of one kana, as cells.
 *
 * A CELL IS KEPT EVEN AT ONE MEMBER. あ has a katakana twin and nothing else,
 * and the answer to that is one cell holding one character — not a collapsed
 * line, and not a cell stretched to fill the width. The section is a set of
 * labelled slots; a slot with one thing in it is still that slot, and making it
 * look different would suggest あ's twin is a different KIND of relation from
 * き's.
 *
 * は is the other end and is the reason the section is full-width: it needs a
 * fifth cell, because it takes both ば and ぱ. Laid out inside a column that
 * also holds the mnemonic, that fifth cell would reflow everything above it.
 *
 * Empty for a katakana glyph, a combo, or a voiced form — those are family
 * MEMBERS, and a page listing its own siblings from the middle of the group
 * would have to explain which one is the base. The base kana's page is the one
 * that owns the map.
 */
export function kanaFamily(glyph: string): readonly FamilyCell[] {
  if (!isHiragana(glyph) || glyph.length !== 1) return [];
  // A voiced form is not a base: ぎ decomposes, so it has a parent.
  if (glyph.normalize("NFD").length > 1) return [];

  const twin = twinOf(glyph);
  const cells = [
    cell("Katakana", twin ? [twin] : []),
    cell("Voiced", markedForms(glyph, DAKUTEN)),
    cell("Half-voiced", markedForms(glyph, HANDAKUTEN)),
    cell("Combos", combosOf(glyph)),
  ];
  return cells.filter((c): c is FamilyCell => c !== null);
}

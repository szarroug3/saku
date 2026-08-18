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

const SMALL_TO_FULL_HIRAGANA: Readonly<Record<string, string>> = {
  ゃ: "や",
  ゅ: "ゆ",
  ょ: "よ",
};

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

function katakanaOf(glyph: string): string | null {
  if (glyph.length !== 1 || !isHiragana(glyph)) return null;
  const twin = String.fromCodePoint((glyph.codePointAt(0) as number) + KATAKANA_OFFSET);
  return CHAR_INDEX[twin] ? twin : null;
}

/** The katakana written for the same sound, when the app teaches it. */
function twinOf(glyph: string): string | null {
  return katakanaOf(glyph);
}

function comboTwinOf(glyph: string): string | null {
  const parts = Array.from(glyph);
  if (parts.length !== 2 || !parts.every(isHiragana)) return null;
  const twin = parts
    .map((p) => String.fromCodePoint((p.codePointAt(0) as number) + KATAKANA_OFFSET))
    .join("");
  return twin.length === 2 && CHAR_INDEX[twin] ? twin : null;
}

function taughtLinkGlyph(glyph: string): string | null {
  if (CHAR_INDEX[glyph]) return glyph;
  const full = SMALL_TO_FULL_HIRAGANA[glyph];
  if (full && CHAR_INDEX[full]) return full;
  return null;
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
/**
 * Confusables for a DERIVED (dakuten/handakuten) kana — its own base kana, plus
 * any other marked kana built off that SAME base. は takes both marks, so ば's
 * natural confusable set is [は, ぱ]; が's is just [か], because the k row has no
 * handakuten twin. This is a live NFD query, independent of both `kanaFamily`
 * (which refuses to run FROM a marked form — "a voiced form ... owns no map of
 * its own", above) and of the hand-curated LOOKALIKES table in characters.ts:
 * nothing is authored here, it falls out of Unicode the same way `markedForms`
 * does.
 *
 * Empty for anything that isn't itself a derived, taught kana — a base kana, a
 * combo, or a glyph the app doesn't teach.
 */
export function derivedKanaConfusables(glyph: string): readonly EntryId[] {
  if (glyph.length !== 1) return [];
  const nfd = glyph.normalize("NFD");
  if (nfd.length !== 2) return [];
  const base = nfd[0];
  if (!CHAR_INDEX[base]) return [];
  const siblings = [...markedForms(base, DAKUTEN), ...markedForms(base, HANDAKUTEN)].filter(
    (g) => g !== glyph,
  );
  return [kanaEntry(base), ...siblings.map(kanaEntry)];
}

/**
 * The two codepoints [base, small] of a taught yōon combo — きゃ → [き, ゃ] —
 * or null for anything else. Gated on CHAR_INDEX rather than a bare "two
 * hiragana codepoints, second one small" test, for the same reason every other
 * derivation in this file is: a two-character STRING that happens to look like
 * a combo but isn't one of the 72 the app actually teaches must answer null,
 * not synthesize a page for a character nobody drills.
 *
 * Used by strokes.ts (SAK-72 Part B) to know which two independently-ingested
 * glyphs to compose into one stroke diagram — KanjiVG has no precomposed きゃ
 * of its own, only き and ゃ each on their own 109×109 grid.
 */
export function yoonParts(glyph: string): readonly [string, string] | null {
  if (!CHAR_INDEX[glyph]) return null;
  const parts = Array.from(glyph);
  if (parts.length !== 2) return null;
  return [parts[0], parts[1]];
}

/** The full-size kana a small yōon kana stands in for — ゃ → や, ャ → ヤ — or
 * null if it isn't one. SMALL_TO_FULL_HIRAGANA only tables the hiragana half;
 * a katakana small kana (ャュョ) is answered by stepping it back to hiragana,
 * looking that up, then stepping the result forward again — the same
 * codepoint-offset trick `katakanaOf`/`twinOf` use above, so the katakana
 * table stays DERIVED rather than a second hand-typed copy of the hiragana
 * one.
 *
 * Exported: KanaEntryView's Related section (SAK-72 correction) reuses this
 * SAME mapping to link a yōon page to the full-size version of its small kana
 * (きゃ → や, not ゃ), rather than re-deriving the katakana step-back trick a
 * second time. */
export function fullSizeOf(small: string): string | null {
  const isKata = !isHiragana(small);
  const hiraSmall = isKata
    ? String.fromCodePoint((small.codePointAt(0) as number) - KATAKANA_OFFSET)
    : small;
  const hiraFull = SMALL_TO_FULL_HIRAGANA[hiraSmall];
  if (!hiraFull) return null;
  return isKata
    ? String.fromCodePoint((hiraFull.codePointAt(0) as number) + KATAKANA_OFFSET)
    : hiraFull;
}

/**
 * Confusables for a YŌON kana — its base kana, the FULL-SIZE version of its
 * small kana (きゃ's small ゃ has no page of its own, but its full-size twin や
 * does — the size IS the whole distinction, per COMBO_H's own text: "きゃ,
 * with the small ゃ, is 'kya'. きや, with a full-size や, is 'kiya'"), and its
 * siblings sharing the same base (きゃ/きゅ/きょ). Mirrors
 * derivedKanaConfusables's shape and the same CHAR_INDEX-gated discipline —
 * empty for anything that isn't itself a taught yōon combo.
 */
export function yoonConfusables(glyph: string): readonly EntryId[] {
  const parts = yoonParts(glyph);
  if (!parts) return [];
  const [base, small] = parts;
  const fullSize = fullSizeOf(small);
  const siblings = combosOf(base).filter((c) => c !== glyph);
  const glyphs = [base, ...(fullSize && CHAR_INDEX[fullSize] ? [fullSize] : []), ...siblings];
  return glyphs.map(kanaEntry);
}

export function kanaFamily(glyph: string): readonly FamilyCell[] {
  if (!isHiragana(glyph[0])) return [];

  const comboParts = Array.from(glyph);
  if (comboParts.length === 2 && comboParts.every(isHiragana)) {
    const twin = comboTwinOf(glyph);
    const builtFromMembers = comboParts
      .map((part) => {
        const linkGlyph = taughtLinkGlyph(part);
        if (!linkGlyph) return null;
        return { glyph: part, entry: kanaEntry(linkGlyph) };
      })
      .filter((m): m is { glyph: string; entry: EntryId } => m !== null);
    const cells = [
      builtFromMembers.length
        ? ({ title: "Built from", members: builtFromMembers } as FamilyCell)
        : null,
      cell("Katakana", twin ? [twin] : []),
    ];
    return cells.filter((c): c is FamilyCell => c !== null);
  }

  if (glyph.length !== 1) return [];
  // A voiced form is not a base: ぎ decomposes, so it has a parent.
  if (glyph.normalize("NFD").length > 1) return [];

  const twin = twinOf(glyph);
  const cells = [
    cell("Katakana", twin ? [twin] : []),
    cell("Voiced", markedForms(glyph, DAKUTEN)),
    cell("Half-voiced", markedForms(glyph, HANDAKUTEN)),
    cell("Yōon", combosOf(glyph)),
  ];
  return cells.filter((c): c is FamilyCell => c !== null);
}

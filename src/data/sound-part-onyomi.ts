// The on'yomi of the pieces a kanji's origin names for its sound that the
// kanji table has no reading for (SAK-486).
//
// A kanji's origin prose says "the sound of 也" on 他, and the Sky writes the
// piece's on'yomi over it (SAK-484). The kanji table only knows the 2,136
// jōyō kanji, so a piece outside them (也, 弋, 丂, 𠂇) had nothing to print.
// scripts/ingest/sound-part-onyomi.ts reads those pieces' on'yomi out of
// KANJIDIC2 into generated/sound-part-onyomi.json, and only for the pieces the
// origin prose names this way, so the table stays small.
//
// LICENSE: the DATA is from KANJIDIC2, CC BY-SA 4.0, Electronic Dictionary
// Research and Development Group. See src/data/generated/sources.json.

import table from "./generated/sound-part-onyomi.json" with { type: "json" };

/** A piece an origin names for its sound, with no reading after it in
 * brackets ("the sound of 士 (し)" already has one). The piece is one
 * character from the CJK blocks, the extensions beyond the basic plane
 * included (𠂇 on 左), and the radical forms (⺕ on 雪). */
export const SOUND_OF = /the sound of ([⺀-⻿㐀-䶿一-鿿\u{20000}-\u{3FFFF}])(?!\s*[(（])/gu;

const ONS = table as Readonly<Record<string, readonly string[]>>;

/** A piece's on'yomi in hiragana, in KANJIDIC2's order, or none when the
 * piece is not in the table (KANJIDIC2 has no on'yomi for it, or the origin
 * prose never names it for its sound). */
export function soundPartOnyomi(piece: string): readonly string[] {
  return ONS[piece] ?? [];
}

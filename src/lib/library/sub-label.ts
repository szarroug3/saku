// What a Library tile or row prints under the glyph.
//
// It lives in a .ts, not beside the JSX in entry-tile.tsx, so the test runner
// (Node's type stripper, no JSX) can hold the property it exists to keep: no
// entry that HAS something to say prints a dash instead.
//
// TWO KINDS OF "MANY READINGS", AND THEY ARE NOT THE SAME FACT
// ============================================================
// 生 has nine readings and they are nine DIFFERENT sounds. Printing "生 · せい"
// would be picking one of the nine and presenting it as THE reading — the
// entry page is where the nine live, and the tile says the meaning instead.
//
// し has two "readings", shi and si, and they are ONE sound spelled two ways —
// Hepburn and Kunrei, the same syllable however you transcribe it. There is no
// pick being made, so there is nothing to protect the reader from: "shi · si"
// is the whole truth about し and it is exactly what the entry page prints.
//
// Collapsing those two cases into one `readings.length === 1` guard is what
// made 42 kana — し ち つ ふ を ん じ ぢ づ and every しゃ/ちゃ/じゃ combo —
// show a dash. A kana carries no meanings to fall back to, so the guard sent
// the ONE group of kana whose romanisation is not mechanical, the group a
// beginner most needs told, to "—". They are told now.

import { KANA_SUBJECT } from "@/data/characters";
import type { LibEntry } from "@/lib/library/entries";

/** How the entry page joins a reading list, so a tile and the page it opens
 * agree on what し says. */
export const READING_SEP = " · ";

/** The line under the glyph: its reading(s) for kana, its one reading for
 * anything with exactly one, its meaning for a kanji with many — and a dash
 * only when the entry genuinely has neither. */
export function subLabel(entry: LibEntry): string {
  // Kana first: every romanisation it carries, because they are spellings of
  // one sound rather than a choice among sounds.
  if (entry.kind === KANA_SUBJECT && entry.readings.length > 0) {
    return entry.readings.join(READING_SEP);
  }
  return entry.readings.length === 1
    ? entry.readings[0]
    : (entry.meanings[0] ?? "—");
}

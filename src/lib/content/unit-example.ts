// exampleFor — a concrete word that shows a teaching unit's pronunciation in use.
//
// A unit is one PRONUNCIATION of a glyph (`unit.reading`, a kana string, or null
// for a meaning-only unit). This reads the app's own data to find a word that
// demonstrates the glyph being read that way — it derives nothing, it looks up:
//
//   - The kanji reading data already pairs each reading with an ANCHOR WORD (the
//     word the reading fact is asked in): 人 read にん is anchored to 人間. That
//     anchor is the example; its gloss is the anchor word's first vocab gloss.
//   - Failing an anchor, a glyph that is ITSELF a word read this way stands as its
//     own example — a reading shown on the bare word (口 read くち → 口).
//   - A meaning-only unit (reading null), or a reading with neither, has none.

import { READINGS } from "@/data/kanji";
import { vocabRow } from "@/data/vocab";
import type { TeachingUnit, UnitExample } from "./teach-unit";

/**
 * A concrete word demonstrating `unit`'s pronunciation, or null when there is
 * none to show (a meaning-only unit, or a reading with no anchor and no standalone
 * word). The gloss is the example word's first vocab gloss, or null if the word
 * is not in the vocabulary.
 */
export function exampleFor(unit: TeachingUnit): UnitExample | null {
  const reading = unit.reading;
  if (reading == null) return null; // meaning-only unit — no pronunciation to show.

  // Prefer the anchor word the reading data already pairs with this pronunciation
  // (人 + にん → 人間). `base` is the KANJIDIC2 reading these units carry.
  const anchored = READINGS.find((r) => r.k === unit.glyph && r.base === reading);
  if (anchored) {
    return { word: anchored.anchor, gloss: vocabRow(anchored.anchor)?.glosses[0] ?? null };
  }

  // No anchor, but the glyph itself is a word read this way — show the bare word.
  const own = vocabRow(unit.glyph);
  if (own && own.reb === reading) {
    return { word: unit.glyph, gloss: own.glosses[0] ?? null };
  }

  return null;
}

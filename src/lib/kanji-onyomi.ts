// The on'yomi surface of a kanji, and the everyday compound where a phonetic
// piece's lent reading actually sounds.
//
// WHY THIS IS A LIB AND NOT PART OF THE ETYMOLOGY LAYER
// ====================================================
// src/data/kanji-etymology.ts owns the JOIN — which piece is semantic, which is
// phonetic, and the reading a phonetic piece lends its host (phoneticReading).
// It deliberately stops there: it knows the reading, not the WORD that reading
// shows up in, because the word lives in the vocabulary, not the readings row's
// sound. This module closes that last gap for the UX — it reads the app's own
// READINGS (the (kanji, reading, anchor-word) table) and VOCAB (the anchor's
// full reading) so the Built-from tile can print 河's 可(か) with 河川 (かせん)
// beside it, and so the kanji page can name a kanji's on-readings as a hint.
//
// Everything here is DERIVED, never invented: an on-reading with no everyday
// anchor word shows no example, exactly the discipline the etymology layer keeps.

import { READINGS, type ReadingRow } from "@/data/kanji";
import { vocabRow } from "@/data/vocab";

/** A kanji's on-readings, grouped once at module load. On'yomi is KANJIDIC2's
 * "on" plus the handful it files as "both" (a reading it lists under on AND kun
 * for different senses). Kun-only readings are left out — this is the borrowed,
 * compound-word sound. */
const ON_ROWS_BY_KANJI: ReadonlyMap<string, readonly ReadingRow[]> = (() => {
  const map = new Map<string, ReadingRow[]>();
  for (const r of READINGS) {
    if (r.type !== "on" && r.type !== "both") continue;
    const list = map.get(r.k);
    if (list) list.push(r);
    else map.set(r.k, [r]);
  }
  // Richest evidence first, the same order the entry page's readings table uses,
  // so the hint leads with the on-reading the learner meets in the most words.
  for (const list of map.values()) list.sort((a, b) => b.nWords - a.nWords);
  return map;
})();

/** One on-reading of a kanji, with the everyday word that attests it. */
export interface OnReading {
  /** The on-reading in kana — こう for 校. */
  readonly reading: string;
  /** An everyday word the kanji takes this reading in — 校門. Null when the
   * ingest found none. */
  readonly word: string | null;
  /** That word's full reading — こうもん. Null when the word has no vocabulary
   * row (so we cannot state its reading) or there is no word at all. */
  readonly wordReading: string | null;
}

/** Does this kanji have an on'yomi at all? The gate the on'yomi concept card
 * rides in on — the first curriculum kanji this is true of is where the learner
 * first meets the borrowed-reading idea. */
export function hasOnyomi(kanji: string): boolean {
  return ON_ROWS_BY_KANJI.has(kanji);
}

/** A kanji's on-readings, richest evidence first, each with an example word and
 * that word's reading where the data has one. Empty for a kanji with no on'yomi
 * (many kun-only jōyō kanji). Display only — nothing here is graded. */
export function onReadingsOf(kanji: string): readonly OnReading[] {
  const rows = ON_ROWS_BY_KANJI.get(kanji);
  if (!rows) return [];
  return rows.map((r) => {
    const word = r.anchor || null;
    return {
      reading: r.base,
      word,
      wordReading: word ? (vocabRow(word)?.reb ?? null) : null,
    };
  });
}

/** One everyday compound where a phonetic piece's lent reading surfaces. */
export interface PhoneticExample {
  /** The compound word — 河川. */
  readonly word: string;
  /** Its reading — かせん. Null when the word has no vocabulary row. */
  readonly reading: string | null;
}

/**
 * The everyday word that shows a phonetic piece's lent reading on its HOST — the
 * one place the borrowed sound actually surfaces. Given the host kanji (河) and
 * the reading its phonetic piece lends it (か, from phoneticReading), find the
 * host's on-reading row for that exact reading and return its anchor word (河川)
 * with the word's reading (かせん).
 *
 * Null when the host takes no such on-reading in an everyday word — the same
 * "show nothing rather than guess" the whole feature keeps.
 */
export function phoneticExample(host: string, lentReading: string): PhoneticExample | null {
  const rows = ON_ROWS_BY_KANJI.get(host);
  if (!rows) return null;
  const row = rows.find((r) => r.base === lentReading);
  if (!row || !row.anchor) return null;
  return { word: row.anchor, reading: vocabRow(row.anchor)?.reb ?? null };
}

// The radical subject: the 214 classical Kangxi radicals, and the join from a
// kanji to the one radical it is filed under.
//
// WHY RADICALS ARE A SUBJECT
// ==========================
// A radical is the shared shape a kanji is built around and indexed by — 氵 is
// water, and 海 泳 湖 are all "water" kanji before you know a single reading. The
// app teaches each radical's MEANING as its own fact and gates a kanji on it, so
// no kanji is ever taught with a component the learner has never met. That is
// the same debt the word track pays to kanji, one layer down: words gate on
// kanji, kanji gate on radicals.
//
// WHAT A RADICAL FACT IS
// ======================
// One meaning fact per radical — "what does 氵 mean" has one answer (water), so
// unlike a kanji reading it grades cleanly with no context word. There is no
// reading fact: a radical is a shape and an idea, not a pronunciation, and the
// Japanese bushu names (さんずい) are a later enrichment the data does not yet
// carry (see scripts/ingest/radicals.mjs on why variant forms and names are
// deliberately absent for now).
//
// THE DATA IS GENERATED JSON, for the same reasons kanji.ts is: it is derived
// from Unicode + KANJIDIC2 by scripts/ingest/radicals.mjs and nobody edits it by
// hand. radicals.json is the 214 table; kanji-radicals.json is the per-kanji
// classical radical number.

import radicalsJson from "./generated/radicals.json" with { type: "json" };
import kanjiRadicalsJson from "./generated/kanji-radicals.json" with { type: "json" };
import { entryId, factId } from "../lib/fact-id.ts";
import type { EntryId, FactId, FactInfo } from "../types/index.ts";

export const RADICAL_SUBJECT = "radical";

/** One classical Kangxi radical. */
export interface RadicalRow {
  /** Kangxi number, 1–214, the canonical index and browse order. */
  readonly num: number;
  /** The glyph to show — the Japanese form where it differs from the Kangxi
   * traditional one (戸 not 戶, 青 not 靑). 124 of the 214 are themselves jōyō
   * kanji; the entry id keeps them apart by subject (radical:水 vs kanji:水). */
  readonly glyph: string;
  /** The radical's meaning, from Unicode's Kangxi Radicals block. */
  readonly meaning: string;
  readonly strokes: number;
}

export const RADICALS: readonly RadicalRow[] = radicalsJson as readonly RadicalRow[];

const BY_NUM: ReadonlyMap<number, RadicalRow> = new Map(
  RADICALS.map((r) => [r.num, r]),
);
const BY_GLYPH: ReadonlyMap<string, RadicalRow> = new Map(
  RADICALS.map((r) => [r.glyph, r]),
);

/** Kanji glyph → its one classical Kangxi radical number. Complete over the
 * 2,136 jōyō; the ingest fails rather than ship a kanji with no radical. */
const RADICAL_OF: Readonly<Record<string, number>> =
  kanjiRadicalsJson as Record<string, number>;

/** The radical with this Kangxi number. */
export function radicalRow(num: number): RadicalRow | undefined {
  return BY_NUM.get(num);
}

/** The radical drawn with this glyph. */
export function radicalByGlyph(glyph: string): RadicalRow | undefined {
  return BY_GLYPH.get(glyph);
}

/** The radical a kanji is filed under — the one it gates on. */
export function radicalOfKanji(kanji: string): RadicalRow | undefined {
  const num = RADICAL_OF[kanji];
  return num === undefined ? undefined : BY_NUM.get(num);
}

export function radicalEntry(glyph: string): EntryId {
  return entryId(RADICAL_SUBJECT, glyph);
}

export function radicalMeaningFactId(glyph: string): FactId {
  return factId(radicalEntry(glyph), "meaning");
}

/** Every radical fact: 214 meanings, one per radical. */
export const RADICAL_FACTS: FactInfo[] = RADICALS.map((r) => ({
  id: radicalMeaningFactId(r.glyph),
  entry: radicalEntry(r.glyph),
  glyph: r.glyph,
  answers: [r.meaning],
  subject: RADICAL_SUBJECT,
  meaning: r.meaning,
}));

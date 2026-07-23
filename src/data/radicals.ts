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
import orderJson from "./generated/order.json" with { type: "json" };
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

// THE SHAPE A RADICAL IS WRITTEN WITH, WHERE THE TABLE HAS THE OTHER ONE
// =======================================================================
// The 214 table carries ONE glyph per radical, and for radical 162 that glyph is
// 辵. No modern character is drawn with 辵: 道 通 遠 and 49 others are drawn with
// 辶 (KanjiVG calls the component ⻌ and records 辶 as what it is a form of). So a
// consumer that starts from a DECOMPOSITION and asks "which radical is this
// shape" gets nothing for the commonest running-shape in the language, and 52
// characters end up owing no radical for a piece every one of them contains.
//
// This bridge is the missing edge, and it is exactly the case scripts/ingest/
// radicals.mjs already knows about and has deliberately deferred: its JP_GLYPH
// map remaps the two radicals whose Kangxi glyph is the traditional form (戶→戸,
// 靑→青), and its header says a full Japanese variant map "needs a verified
// curated source and is a follow-up". 162 is that follow-up. It is written here
// rather than in the ingest because the ingest's two sources genuinely do not
// attest it — Unicode's compat mapping gives 辵 and KanjiVG's chain stops at 辶,
// so producing the edge there would mean writing a fact into a generated file
// that the pipeline cannot re-derive. When JP_GLYPH grows a verified source, 162
// belongs in it and this map goes away.
//
// ADDITIVE, ON PURPOSE. `radicalByGlyph` is untouched, so nothing that asks what
// a character IS changes its answer (辶 is still not a radical row, and there is
// still no radical entry, card or fact for it). Only a caller that opts into
// `radicalByWrittenForm` sees the edge.
const WRITTEN_FORM: ReadonlyMap<string, number> = new Map([
  ["辶", 162], // the running shape; the table has 辵
]);

/**
 * The radical drawn with this glyph, counting the modern written form as the
 * radical it is a form of: `radicalByGlyph` first, then the bridge above.
 *
 * For a caller reading a decomposition, where the question is "what does this
 * piece of the glyph oblige the learner to know". Use `radicalByGlyph` when the
 * question is what a character is.
 */
export function radicalByWrittenForm(glyph: string): RadicalRow | undefined {
  const own = BY_GLYPH.get(glyph);
  if (own) return own;
  const num = WRITTEN_FORM.get(glyph);
  return num === undefined ? undefined : BY_NUM.get(num);
}

/** The radical a kanji is filed under — the one it gates on. */
export function radicalOfKanji(kanji: string): RadicalRow | undefined {
  const num = RADICAL_OF[kanji];
  return num === undefined ? undefined : BY_NUM.get(num);
}

// RADICALS THAT ARE ALSO KANJI, AND ARE TAUGHT ONCE — AS THE KANJI
// ================================================================
// 124 of the 214 radicals ARE themselves jōyō kanji: 乙 is Kangxi radical 5 and
// it is also a kanji the curriculum teaches on its own. Taught as both a radical
// card and a kanji card, that character is learned twice — once as "second" the
// radical, again as "second" the kanji — which is the redundancy the owner hit
// with 乙. The fix is to teach it ONCE, as the kanji, and let the kanji card say
// it is also a radical. So the radical card is dropped for these and the kanji
// card carries the second role.
//
// BUT ONLY WHERE THE ORDER LETS US. A radical is taught just before the FIRST
// kanji that is filed under it, so that no kanji is ever broken into a shape the
// learner has not met. For a both-roles character that is safe to merge only
// when the character is ITS OWN first consumer — when the earliest kanji filed
// under the radical is the radical's own glyph. Then the moment the kanji is
// reached is the moment the radical is first needed, and teaching the kanji
// there pays both debts at once with nothing arriving early.
//
// 8 of the 124 are NOT their own first consumer: 火 (radical 86) is needed as a
// component of 点 long before 火 itself is reached in the everyday order, and 玉
// (radical 96) is even built from 王, a kanji filed under 玉 — merging 玉 into a
// single kanji lesson would have to teach it before its own part. Those 8 keep
// their separate radical card (taught at the early, first-needed spot) and their
// later kanji card; only the 116 coincident ones merge. `radicalOrder` reads
// this set to drop the merged radicals from the radical track, `radical-known`
// reads it so a merged radical never gates a kanji (it is the kanji), and the
// kanji card reads `radicalByGlyph` to add the "also a radical" line.
//
// EVERYDAY ORDER IS THE REFERENCE. First-consumer is computed off the shipped
// everyday order (order.json), the same order radicalOrder's teaching sequence
// is built from. The grade and newspaper orders re-sequence the kanji, so a
// merged character could in principle be reached a little after a consumer
// there; that is a soft ordering nicety in a non-default order, never a block,
// because a merged radical simply does not gate.
const ORDER_INDEX: ReadonlyMap<string, number> = new Map(
  (orderJson as ReadonlyArray<{ c: string; i: number }>).map((o) => [o.c, o.i]),
);

/** The everyday-order position of the earliest kanji filed under each radical —
 * the radical's first consumer. Absent for the 16 radicals no jōyō kanji uses. */
const FIRST_CONSUMER: ReadonlyMap<number, number> = (() => {
  const first = new Map<number, number>();
  for (const [kanji, num] of Object.entries(RADICAL_OF)) {
    const i = ORDER_INDEX.get(kanji);
    if (i === undefined) continue;
    const seen = first.get(num);
    if (seen === undefined || i < seen) first.set(num, i);
  }
  return first;
})();

/** The radical numbers taught once, as their own kanji: the glyph is a jōyō
 * kanji AND it is the earliest kanji filed under the radical, so reaching the
 * kanji is exactly when the radical is first needed. 116 of the 214. */
const TAUGHT_AS_KANJI: ReadonlySet<number> = new Set(
  RADICALS.filter((r) => {
    const own = ORDER_INDEX.get(r.glyph);
    return own !== undefined && FIRST_CONSUMER.get(r.num) === own;
  }).map((r) => r.num),
);

/**
 * Is this radical taught as its own kanji rather than as a separate radical
 * card? True for the 116 both-roles characters whose glyph is their radical's
 * first consumer (乙, 一, 人, 水 …); false for the 90 radical-only shapes (they
 * are not kanji) and for the 8 both-roles characters that are needed as a
 * component before their own kanji is reached (火 玉 八 小 己 示 肉 阜).
 */
export function isRadicalTaughtAsKanji(num: number): boolean {
  return TAUGHT_AS_KANJI.has(num);
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

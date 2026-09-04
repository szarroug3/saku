// Real items for the Sky gallery, read from the app's kanji and vocab tables.
//
// Server-side only, and dev only: this folder is exempt from the Sky
// boundary, and it is the one place the app's data meets Sky code before
// cutover. A pretend learner's standings come with it, so sharing, cost and
// colour all have something to show.

import { kanjiRow, variantTaughtKanji } from "@/data/kanji";
import { vocabRow } from "@/data/vocab";
import type { Standing } from "@/sky/lib/standing";
import type { SkyItem } from "@/sky/lib/types";

/** A few real words with overlapping kanji, so sharing shows. */
export const WORDS = ["日本", "大学", "火山", "水田", "時間", "電車", "休む", "学生"];

/** A pretend learner: what they already have, by glyph. */
const STANDINGS: Record<string, Standing> = {
  日: "solid", 本: "solid", 大: "solid", 学: "getting-there", 火: "solid", 山: "claimed",
  木: "solid", 人: "solid", 亻: "claimed", 日本: "solid", 大学: "getting-there",
};
const standingOf = (glyph: string): Standing => STANDINGS[glyph] ?? "not-seen";

/** The app's tables, read into the Sky's item shape: a word is its kanji; a
 * kanji is its direct components, which are kanji themselves or primitives. */
export function itemsFor(words: readonly string[]): SkyItem[] {
  const items = new Map<string, SkyItem>();
  const addGlyph = (c: string): void => {
    if (items.has(c)) return;
    const row = kanjiRow(c);
    if (row) {
      items.set(c, { id: c, kind: "kanji", glyph: c, english: row.meanings[0] ?? c, standing: standingOf(c), components: [...row.comps] });
      for (const comp of row.comps) addGlyph(comp);
      return;
    }
    const of = variantTaughtKanji(c);
    const base = of ? kanjiRow(of) : undefined;
    items.set(c, { id: c, kind: "radical", glyph: c, english: base ? `a form of ${base.meanings[0]}` : "a piece with no name of its own", standing: standingOf(c) });
  };
  for (const keb of words) {
    const row = vocabRow(keb);
    const kanji = [...keb].filter((c) => kanjiRow(c));
    items.set(keb, { id: keb, kind: "word", glyph: keb, english: row?.senses[0]?.glosses[0] ?? keb, reading: row?.reb, standing: standingOf(keb), components: kanji });
    for (const c of kanji) addGlyph(c);
  }
  return [...items.values()];
}

// The ten Sino number kanji 一…十, and the predicate that names them.
//
// WHY THEY ARE A SET OF THEIR OWN
// ===============================
// These ten are ideographs / borrowed signs, not compositions. Only 二 (一+一)
// and 三 (一+一+一) decompose into anything meaningful, and even they are learned
// as "one more stroke than the last"; 四…十 are memorised wholes whose KanjiVG
// pieces (囗, 儿, 亠, 丿, 乙, the 八-shape inside 六) are SHAPE-ONLY — they imply a
// meaning the character does not carry and mislead a learner into reading a
// number as parts. 一 is atomic and taught first anyway, and 二/三 follow it.
//
// So the numbers track teaches all ten as WHOLE items (their own tile, no
// component sub-tiles) and their Library / lesson "Built from" box is hidden. The
// list lives here, in data, so the three readers agree on the same ten glyphs:
// the prereq walk (src/lib/kanji-prereqs.ts) treats them as leaves in the numbers
// track, `builtFrom` (src/lib/library/entries.ts) returns nothing for them, and
// the counters shelf (src/lib/library/counter-shelf.ts) surfaces them as a group.
//
// SCOPE: the number KANJI only. Counters (人 本 匹 …) and every other kanji keep
// their normal decomposition — this set does not touch them.

/** The Sino number kanji 一…十, in counting order. */
export const NUMBER_KANJI: readonly string[] = [
  "一", "二", "三", "四", "五", "六", "七", "八", "九", "十",
];

const NUMBER_KANJI_SET: ReadonlySet<string> = new Set(NUMBER_KANJI);

/** Is `glyph` one of the ten Sino number kanji taught as a whole? Number kanji
 * skip component-teaching and hide "Built from"; nothing else does. */
export function isNumberKanji(glyph: string): boolean {
  return NUMBER_KANJI_SET.has(glyph);
}

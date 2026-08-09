import type { BuiltPiece } from "@/data/kanji-etymology";

// Recovered Built-from tiles for kanji whose automated etymology join dropped a
// visible piece that genuinely IS the unmatched Wiktionary component (a variant
// of it, or the dropped pieces literally reassemble into its shape).
//
// Slice 57–111 (55 kanji) reviewed. 8 recoveries below; the other 47 stay
// dropped (near-homograph confusions, corruptions, redraws, and incomplete /
// nested pieces — the story already covers those components).
export const REASSEMBLY_B: Readonly<Record<string, readonly BuiltPiece[]>> = {
  宴: [
    { glyph: "宀", role: "semantic", label: null },
    { glyph: "妟", role: "phonetic", label: "えん" },
  ], // 妟 = ⿱日女; the dropped 日 + 女 reassemble into it. source: en.wiktionary.org/wiki/妟
  岸: [
    { glyph: "屵", role: "semantic", label: "cliff" },
    { glyph: "干", role: "phonetic", label: null },
  ], // 屵 = ⿱山厂; the dropped 山 + 厂 reassemble into it. source: en.wiktionary.org/wiki/屵
  幽: [
    { glyph: "山", role: "semantic", label: null },
    { glyph: "𢆶", role: "phonetic", label: "ゆう" },
  ], // 𢆶 = 幺 + 幺; the two dropped 幺 reassemble into it. source: en.wiktionary.org/wiki/幽
  幾: [
    { glyph: "𢆶", role: "semantic", label: "silk threads; little things" },
    { glyph: "戍", role: "semantic", label: "to guard against" },
  ], // 𢆶 = 幺 + 幺; the two dropped 幺 reassemble into it. source: en.wiktionary.org/wiki/幾
  弥: [
    { glyph: "弓", role: "semantic", label: "bow" },
    { glyph: "尓", role: "phonetic", label: null },
  ], // 尓 is the JHKT variant form of the phonetic 尔; host has no on-reading, so label null. source: en.wiktionary.org/wiki/弥
  恐: [
    { glyph: "巩", role: "phonetic", label: "きょう" },
    { glyph: "心", role: "semantic", label: "heart" },
  ], // 巩 = ⿰工凡; the dropped 工 + 凡 reassemble into it. source: en.wiktionary.org/wiki/恐
  懇: [
    { glyph: "貇", role: "phonetic", label: "こん" },
    { glyph: "心", role: "semantic", label: "heart" },
  ], // 貇 = ⿰豸艮; the dropped 豸 + 艮 reassemble into it. source: en.wiktionary.org/wiki/貇
  捗: [
    { glyph: "扌", role: "semantic", label: "hand" },
    { glyph: "歩", role: "phonetic", label: "ちょく" },
  ], // 歩 is the Japanese shinjitai variant of the phonetic 步. source: en.wiktionary.org/wiki/捗
};

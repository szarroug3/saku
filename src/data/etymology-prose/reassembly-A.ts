import type { BuiltPiece } from "@/data/kanji-etymology";
// Recovered Built-from tiles: dropped visible pieces re-joined to their real
// Wiktionary component. Each cites why it's a genuine reassembly/variant.
export const REASSEMBLY_A: Readonly<Record<string, readonly BuiltPiece[]>> = {
  低: [
    { glyph: "亻", role: "semantic", label: "man, person" },
    { glyph: "氐", role: "phonetic", label: "てい" },
  ], // source: en.wiktionary.org/wiki/氐 (氏 + 一)
  // 内 dropped: its component is 入 (to enter) but the shinjitai draws it as 人, so
  // a tile would label the character 人 with 入's sense — the person/enter
  // conflation a learner who knows 人 would misread. The story covers it instead.
  冷: [
    { glyph: "冫", role: "semantic", label: "ice" },
    { glyph: "令", role: "phonetic", label: "れい" },
  ], // 冫 is the everyday form of 仌 (ice); source: en.wiktionary.org/wiki/冫
  凄: [
    { glyph: "冫", role: "semantic", label: "ice" },
    { glyph: "妻", role: "phonetic", label: null },
  ], // 冫 is the everyday form of 仌 (ice); source: en.wiktionary.org/wiki/冫
  凍: [
    { glyph: "冫", role: "semantic", label: "ice" },
    { glyph: "東", role: "phonetic", label: "とう" },
  ], // 冫 is the everyday form of 仌 (ice); source: en.wiktionary.org/wiki/冫
  凝: [
    { glyph: "冫", role: "semantic", label: "ice" },
    { glyph: "疑", role: "phonetic", label: null },
  ], // 冫 is the everyday form of 仌 (ice); source: en.wiktionary.org/wiki/冫
  剝: [
    { glyph: "彔", role: "phonetic", label: null },
    { glyph: "刂", role: "semantic", label: "knife" },
  ], // source: en.wiktionary.org/wiki/彔 (⿱彑氺); host has no on-reading, so label null
  務: [
    { glyph: "敄", role: "phonetic", label: "む" },
    { glyph: "力", role: "semantic", label: "strength" },
  ], // source: en.wiktionary.org/wiki/敄 (⿰矛攵)
  厚: [
    { glyph: "厂", role: "semantic", label: "cliff; cave on a cliff" },
    { glyph: "𣆪", role: "semantic", label: "jug" },
  ], // source: en.wiktionary.org/wiki/厚 (㫗 = ⿱日子, a jug)
  合: [
    { glyph: "亼", role: "semantic", label: "lid" },
    { glyph: "口", role: "semantic", label: "mouth" },
  ], // source: en.wiktionary.org/wiki/合 (亼 lid/cover + 口); 亼 = ⿱人一
  堅: [
    { glyph: "臤", role: "phonetic", label: "けん" },
    { glyph: "土", role: "semantic", label: null },
  ], // source: en.wiktionary.org/wiki/臤 (⿰臣又)
  契: [
    { glyph: "㓞", role: "phonetic", label: "けい" },
    { glyph: "大", role: "semantic", label: "person" },
  ], // source: en.wiktionary.org/wiki/㓞 (⿰龶刀, to engrave)
};

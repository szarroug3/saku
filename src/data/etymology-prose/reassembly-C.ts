import type { BuiltPiece } from "@/data/kanji-etymology";

// Recovered Built-from tiles for kanji whose automated etymology join dropped a
// visible piece that genuinely IS the unmatched Wiktionary component.
//
// Slice 112–167 reviewed. 9 recoveries.
//
// SKIPPED — dropped pieces do NOT reassemble the component (composition differs):
//   探 / 深 (㓁+木 ← 𥥍): Wiktionary gives 𥥍 = ⿱穴𡗜, not 㓁+木.
//   殺 (乂+木 ← 𣏂): 𣏂 = ⿱㐅朮 (术), not 乂+木 — 朮 collapsed to 木, a corruption.
//   撤 (育+攵 ← 徹), 教 (孝 ← 爻/子), 敷 (旉 ← 尃), 款 (士+示 ← 柰),
//   炊 (欠 ← 吹), 焦 (灬 ← 小): the component needs pieces the drop doesn't supply.
// SKIPPED — corruption / distinct char, NOT a variant:
//   敬 (苟 ← 茍): Wiktionary flags 苟 (U+82DF, grass 艹) and 茍 (U+830D, 龷) as
//     distinct, "not to be confused" — a same-shape collapse, not a variant.
//   敵 / 滴 (啇 ← 啻): 啻 = ⿱帝口, a distinct character from 啇 with a different
//     Old Chinese reading; the drop is not a variant of it and does not build it.
//   星 (日 ← 晶): 晶 is three 日; a single 日 is a reduction, and reads sun/day —
//     labelling it 晶 "stars" would overclaim. Story covers it.
//   改 (己 ← 巳), 支 (十 ← 竹), 散 (月 ← 林), 旦 (一 ← 丁), 旨 (日 ← 甘),
//   早 (十 ← 棗), 昔 (廾 ← 龷), 書 (日 ← 者), 替 (夫+夫 ← 竝), 最 (日 ← 宀),
//   望 (王 ← 𡈼), 期 (月 ← 日), 正 (一 ← 丁), 武, 死 (匕 ← 尸), 殿, 毀,
//   氾, 法, 泰, 津, 活 (舌 ← 𠯑), 浸, 灰 (厂 ← 又), 災, 炉, 熊 (灬 ← 炎):
//     each visible drop is a redrawn/reduced remnant, not the component's shape.
// SKIPPED — kokuji / unsettled: 栃, 斑 (王+王 build only the 王_王 frame of 班).
export const REASSEMBLY_C: Readonly<Record<string, readonly BuiltPiece[]>> = {
  // 施 — reassembly. Dropped 方 + 𠂉 are exactly 㫃 (⿰方人, "flags flying"), the
  //   semantic banner; 也 stays on the right.
  施: [
    { glyph: "㫃", role: "semantic", label: "flag" },
    { glyph: "也", role: "phonetic", label: null },
  ],
  // 族 — reassembly. Dropped 方 + 𠂉 are exactly 㫃 (flag), the semantic;
  //   arrows (矢) gather beneath it.
  族: [
    { glyph: "㫃", role: "semantic", label: "flag" },
    { glyph: "矢", role: "semantic", label: "arrow" },
  ],
  // 旗 — reassembly. Dropped 方 + 𠂉 are exactly 㫃 (flag), the semantic; 其 is
  //   the phonetic on the right.
  旗: [
    { glyph: "㫃", role: "semantic", label: "flag" },
    { glyph: "其", role: "phonetic", label: null },
  ],
  // 樹 — reassembly. Dropped 壴 + 寸 are the modern form of 尌 (⿰壴寸, "to plant"),
  //   the phonetic. Host on-reading じゅ.
  樹: [
    { glyph: "木", role: "semantic", label: "tree" },
    { glyph: "尌", role: "phonetic", label: "じゅ" },
  ],
  // 滅 — reassembly. Dropped 戌 + 火 are exactly 烕 (⿵戌火, "to extinguish"), the
  //   phonetic. Host on-reading めつ.
  滅: [
    { glyph: "氵", role: "semantic", label: "water" },
    { glyph: "烕", role: "phonetic", label: "めつ" },
  ],
  // 漏 — reassembly. Dropped 尸 + 雨 are exactly 屚 (⿸尸雨, "to leak"), the
  //   phonetic. Data lists no on-reading for 漏, so lent reading unconfirmed → null.
  漏: [
    { glyph: "氵", role: "semantic", label: "water" },
    { glyph: "屚", role: "phonetic", label: null },
  ],
  // 然 — reassembly. Dropped 月 + 犬 are exactly 肰 (⿰⺼犬, "dog meat"), the
  //   phonetic; 灬 (fire) sits beneath. Host on-readings ぜん/ねん.
  然: [
    { glyph: "肰", role: "phonetic", label: "ぜん/ねん" },
    { glyph: "灬", role: "semantic", label: "fire" },
  ],
  // 淫 — reassembly. Dropped ⺤ + 壬 are exactly 㸒 (⿱爫壬), the phonetic. Data
  //   lists no on-reading for 淫, so lent reading unconfirmed → null.
  淫: [
    { glyph: "氵", role: "semantic", label: "water" },
    { glyph: "㸒", role: "phonetic", label: null },
  ],
  // 爽 — reassembly. The two flanking 爻 are 㸚 (⿰爻爻), the semantic markings;
  //   the figure 大 stands between them.
  爽: [
    { glyph: "大", role: "semantic", label: null },
    { glyph: "㸚", role: "semantic", label: "markings" },
  ],
};

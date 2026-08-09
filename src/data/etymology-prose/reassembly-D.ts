import type { BuiltPiece } from "@/data/kanji-etymology";

// Recovered Built-from tiles for kanji whose automated etymology join dropped a
// visible piece that genuinely IS the unmatched Wiktionary component.
//
// Slice 168–223 reviewed. 5 recoveries.
//
// SKIPPED (redrawn / distinct):
//   狂 (王 ← 㞷), 疑 (マ+疋 ← 子/止), 監 (𠂉 ← 人 of 臥), 老 (耂 ← 人/毛),
//   脊 (人+二+二 ← 朿), 知 (矢 ← 大/子), 舞, 茶, 舗, 繭, 益, 直, 甚 — dropped
//   pieces do not reassemble the component, only a redrawn/collapsed remnant.
// SKIPPED (corruption / distinct char, NOT a variant):
//   琴 (王+王 ← 珡): 珡 = 玨 + 𠆢; the two 王 form only the 玨 top, not all of 珡.
//   肺 (市 ← 巿): 市 (city) and 巿 (fú) are distinct characters that merely
//     collapsed to the same shape — a corruption, like 則's 貝←鼎, not a variant.
//   犯 (㔾 ← 𢎘): Wiktionary gives phonetic 𢎘; the visible 㔾/卩 is an unexplained
//     reduction, not a confirmed variant of 𢎘.
//   細 (田 ← 囟), 直 (十 ← 丨): both are corruptions of the component, not variants.
export const REASSEMBLY_D: Readonly<Record<string, readonly BuiltPiece[]>> = {
  // 珍 — reassembly. Dropped 人 + 彡 are exactly 㐱 (⿱𠆢彡, "man" + "hair"),
  //   the phonetic. Host on-reading ちん.
  珍: [
    { glyph: "王", role: "semantic", label: null },
    { glyph: "㐱", role: "phonetic", label: "ちん" },
  ],
  // 班 — reassembly. The two flanking 王 are 珏 (⿰𤣩玉, "two pieces of jade"),
  //   the semantic; the knife 刂 sits between them.
  班: [
    { glyph: "珏", role: "semantic", label: "pieces of jade" },
    { glyph: "刂", role: "semantic", label: "knife" },
  ],
  // 緊 — reassembly. Dropped 臣 + 又 are exactly 臤 (⿰臣又), the phonetic.
  //   Host on-reading きん.
  緊: [
    { glyph: "臤", role: "phonetic", label: "きん" },
    { glyph: "糸", role: "semantic", label: null },
  ],
  // 腎 — reassembly. Dropped 臣 + 又 are exactly 臤 (⿰臣又), the phonetic.
  //   Data lists no on-reading for 腎, so lent reading unconfirmed → null.
  腎: [
    { glyph: "臤", role: "phonetic", label: null },
    { glyph: "月", role: "semantic", label: "meat; flesh" },
  ],
  // 緑 — variant. Dropped 彔 is the traditional/everyday form of the phonetic
  //   录 (彔 trad. / 录 simp., same character). Show 彔; host on-reading ろく.
  緑: [
    { glyph: "糸", role: "semantic", label: null },
    { glyph: "彔", role: "phonetic", label: "ろく" },
  ],
};

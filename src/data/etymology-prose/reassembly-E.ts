import type { BuiltPiece } from "@/data/kanji-etymology";

// Recovered Built-from tiles for kanji whose automated etymology join dropped a
// visible piece that genuinely IS the unmatched Wiktionary component.
//
// Slice 224–278 reviewed (tail; 60-wide window ran short). 12 recoveries.
//
// SKIPPED — dropped piece is ONE glyph but reassembles a shape that is NOT the
//   unmatched component (redrawn / partial / corruption remnant):
//   虜 (男 ≠ 力+毌), 表 (二+丨 ← 毛), 責 (龶 ← 朿), 貴 (中 ← 臾),
//   農 (曲 ← 林), 那 (二 ← 冉), 配 (己 ← 卩), 需 (而 ← 天),
//   親 (立+木 = 亲, not the component 辛), 達 (土+羊, corrupted from 羍's 大+羊),
//   遷 (覀+大+己, 三-piece, 䙴 unconfirmed), 難 (艹+口+夫 = 𦰩, not 暵 which has 日),
//   隆 (⻖+夂, abbreviated from 降=阝+夅), 賓 (宀+少, 𡧍 unconfirmed).
// SKIPPED — dropped piece is only PART of / an abbreviation of the component,
//   not a variant nor a full reassembly:
//   衡 (𩵋 vs 角+大), 貌 (豸, only half of 豹=豸+勺), 賢-not, 質-see below,
//   軟 (欠 vs 耎), 辣 (束, only half of 剌=束+刂), 遂/隊 (豕, half of 㒸=八+豕),
//   酎 (寸, part of 肘=月+寸), 韓 (𠦝, part of 倝), 飲 (飠 ≠ phonetic 酓),
//   襲 (龍, one dragon vs 龖=two dragons), 雷 (田, one of 畾=田×3),
//   電 (日 ← 申), 雪 (⺕, only the hand of 彗), 郭 (享 ← 𩫖), 設 (殳 ≠ 埶),
//   赦 (赤 ≠ 亦), 送 (关 ← 灷), 適 (啇 ← 啻).
// SKIPPED — corruption to a distinct character (like 則's 貝←鼎):
//   話 (舌 ← 𠯑), 閉 (才 ← timber 材), 陶 (缶 ≠ earth 土).
// SKIPPED — semantic loan / ambiguous, NOT a confirmed variant:
//   軍 (top 冖: Wiktionary declines to call it a variant of 勹; the real phonetic
//     is "original form of 螾" — unconfirmed reduction).
//   隙 (𡭴): Wiktionary does not give 𡭴's decomposition and documents a 日/白
//     regional split in the middle piece — cannot confirm 小+日+小 = 𡭴.
// SKIPPED — dropped one visible glyph equals TWO semantic components, and no
//   single confident sense-label exists for the merged tile:
//   野 (里 = 田+土), 開 (开 = 一+廾), 退 (艮 = 日+夊), 道 (⻌ = 行-part+止),
//   選 (⻌ ⊃ 止).
export const REASSEMBLY_E: Readonly<Record<string, readonly BuiltPiece[]>> = {
  // 融 — variant. Dropped 虫 is the everyday/simplified form of the phonetic 蟲
  //   (蟲 trad. / 虫 simp., same character; Wiktionary: semantic 鬲 + phonetic 蟲).
  //   Show 虫; host on-reading ゆう.
  融: [
    { glyph: "鬲", role: "semantic", label: "cauldron" },
    { glyph: "虫", role: "phonetic", label: "ゆう" },
  ],
  // 衷 — reassembly. Dropped 口 + 丨 are exactly 中 (⿴口丨), the phonetic.
  //   Host on-reading ちゅう.
  衷: [
    { glyph: "衣", role: "semantic", label: "clothes" },
    { glyph: "中", role: "phonetic", label: "ちゅう" },
  ],
  // 診 — reassembly. Dropped 人 + 彡 are exactly 㐱 (⿱𠆢彡), the phonetic
  //   (cf. 珍). Host on-reading しん.
  診: [
    { glyph: "言", role: "semantic", label: null },
    { glyph: "㐱", role: "phonetic", label: "しん" },
  ],
  // 賢 — reassembly. Dropped 臣 + 又 are exactly 臤 (⿰臣又), the phonetic
  //   (cf. 緊, 腎). Host on-reading けん.
  賢: [
    { glyph: "臤", role: "phonetic", label: "けん" },
    { glyph: "貝", role: "semantic", label: "money" },
  ],
  // 質 — reassembly. Dropped 斤 + 斤 are exactly 斦 (⿰斤斤, "duplication of 斤"),
  //   the semantic. The story reads "Axes (斦) set against a cowrie shell."
  質: [
    { glyph: "斦", role: "semantic", label: "axes" },
    { glyph: "貝", role: "semantic", label: null },
  ],
  // 鎖 — reassembly. Dropped ⺌ + 貝 are exactly 𧴪 (⿱⺌貝), the phonetic.
  //   Host on-reading さ.
  鎖: [
    { glyph: "金", role: "semantic", label: "metal" },
    { glyph: "𧴪", role: "phonetic", label: "さ" },
  ],
  // 陛 — reassembly. Dropped 比 + 土 are exactly 坒 (⿱比土), the phonetic.
  //   Data lists no on-reading for 陛, so the lent reading is unconfirmed → null.
  陛: [
    { glyph: "⻖", role: "semantic", label: null },
    { glyph: "坒", role: "phonetic", label: null },
  ],
  // 陰 — reassembly. Dropped 今 + 云 are exactly 侌 (⿱今云, ancient form of 陰),
  //   the phonetic. Host on-reading いん.
  陰: [
    { glyph: "⻖", role: "semantic", label: null },
    { glyph: "侌", role: "phonetic", label: "いん" },
  ],
  // 隅 — variant. Dropped ⻖ (阝) is the everyday left-ear form of the semantic
  //   𨸏 (阜, "mound"); Wiktionary: semantic 𨸏 + phonetic 禺. Show ⻖ as "mound".
  隅: [
    { glyph: "⻖", role: "semantic", label: "mound" },
    { glyph: "禺", role: "phonetic", label: null },
  ],
  // 負 — variant. Dropped 𠂊 (⺈) is the reduced form of the semantic 人;
  //   Wiktionary glosses the top ⺈ directly as "person" (⺈ + 貝, cowry).
  負: [
    { glyph: "𠂊", role: "semantic", label: "person" },
    { glyph: "貝", role: "semantic", label: "cowry" },
  ],
  // 逸 — variant. Dropped 免 is the Japanese simplified form of the semantic 兔
  //   ("rabbit"): Chinese ⿺辶兔, Japanese ⿺辶免 (same character). Show 免 as "rabbit".
  逸: [
    { glyph: "免", role: "semantic", label: "rabbit" },
    { glyph: "⻌", role: "semantic", label: null },
  ],
  // 飾 — reassembly. Dropped 飠 + 𠂉 are exactly the phonetic 飤 (⿰飠人); Wiktionary
  //   states "the 人 has changed shape into 𠂉." Host on-reading しょく.
  飾: [
    { glyph: "飤", role: "phonetic", label: "しょく" },
    { glyph: "巾", role: "semantic", label: "cloth" },
  ],
};

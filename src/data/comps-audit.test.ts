// Run: node --import ./src/lib/conjugate/test-hooks.mjs --test \
//        src/data/comps-audit.test.ts
//
// WHAT THESE TESTS ARE FOR
// ========================
// `comps` (the "Made of" decomposition, generated/kanji-components.json, merged
// onto KanjiRow.comps in kanji.ts) is validated elsewhere only STRUCTURALLY —
// counts, no self-part, no strangers, dedup (src/lib/library/components.test.ts).
// Nothing there asserts a decomposition is CORRECT: that 休 is 亻+木 and not
// 亻+休, that a re-cut of KanjiVG did not silently reshape what a beginner sees.
// A sibling bug (儿→八 in the `variants` map, same source) proved "guard the
// shape, trust the content" leaves real errors unguarded.
//
// So three CONTENT checks cross-reference `comps` against sources that are
// authoritative about the WHOLE kanji — never against comps itself:
//
//   1. STROKE-COUNT CONSERVATION. A component's strokes are known (KANJIDIC2 for
//      jōyō, primitiveStrokes for the rest). They should roughly sum to the
//      kanji's own stroke count; a gross mismatch is over- or under-counting,
//      i.e. mis-nesting. Flags candidates for review.
//   2. CLASSICAL-RADICAL REACHABILITY. The Kangxi radical KANJIDIC2 assigns
//      (kanji-radicals.json) should, for the large majority, be reachable in the
//      recursive comps closure. The residue is radical-by-tradition-not-shape.
//   3. PINNED SNAPSHOT of the first 100 taught kanji (order.json). These are what
//      a beginner meets first; each was hand-checked against the actual glyph.
//      A re-cut that reshuffles a taught kanji's parts fails loudly here.
//
// WHAT THE AUDIT FOUND (2026-08, today's data)
// ============================================
// No FALSE-attribution error like 儿→八 exists in `comps` for the first 100
// taught kanji: every listed component is genuinely part of its kanji. The two
// real defect classes are milder and SYSTEMATIC, both surfaced by check 1:
//   - DUPLICATE-SURROUND over-count. A wrapping element KanjiVG splits across
//     two child groups is emitted once per side: 国 → [囗 玉 囗], 術 → [行 朮 行],
//     衣-enclosures (衰 哀 裏 褒 …), 斎 → [斉 斉 示 斉]. The part is real but
//     listed twice, so the "Made of" row can show a duplicate.
//   - PARTIAL depth-1. KanjiVG names only one recognisable element and drops the
//     rest: 先 → [儿], 鳥/馬 → [灬], 骨 → [月]. Incomplete, not false.
// Neither is corrected here — comps is re-cut by scripts/ingest/kanjivg.mjs, so
// a fix belongs at ingest or an override layer, not in the committed JSON. These
// checks PIN today's shape so the picture cannot get worse unnoticed.

import assert from "node:assert/strict";
import { describe, test } from "node:test";

import radicalsJson from "./generated/kanji-radicals.json" with { type: "json" };
import radicalDefsJson from "./generated/radicals.json" with { type: "json" };
import { primitiveStrokes } from "./components.ts";
import { KANJI, KANJI_ORDER, kanjiRow, variantOriginal } from "./kanji.ts";

/** KANJIDIC2 `rad_value`: kanji → Kangxi radical number (1–214). Authoritative. */
const RADICAL_OF = radicalsJson as Record<string, number>;
/** Kangxi radical number → its canonical glyph (radicals.json). */
const RADICAL_GLYPH = new Map(
  (radicalDefsJson as { num: number; glyph: string }[]).map((r) => [r.num, r.glyph]),
);

/** Every jōyō kanji that HAS a decomposition (68 of the 2,136 are atomic). */
const DECOMPOSED = KANJI.filter((k) => k.comps.length > 0);

/**
 * Strokes of a single component. A component is either a jōyō kanji (KANJIDIC2
 * stroke count) or a primitive (primitiveStrokes); components.test.ts pins that
 * this split is exhaustive, so a null here would itself be a regression.
 */
function componentStrokes(c: string): number | undefined {
  return kanjiRow(c)?.strokes ?? primitiveStrokes(c);
}

describe("stroke-count conservation — components should sum to the whole", () => {
  // The tolerance. ±3 strokes: a component's canonical standalone count can drift
  // 1–2 from the bound form it is drawn as here (a dropped connecting stroke, a
  // lighter enclosure form), and a legitimately-repeated part costs a couple
  // more. Past ±3 the sum is structurally off — either a surround counted twice
  // or a depth-1 that named one element and dropped the rest. 2,002 of 2,068
  // decomposed kanji (96.8%) conserve within ±3; the 66 that do not are pinned
  // below and are all one of those two documented artifacts, none a false part.
  const TOLERANCE = 3;

  test("every component resolves to a stroke count", () => {
    // Guards the premise of the whole check: if the kanji/primitive split ever
    // stops being exhaustive, this catches it before the sums go quietly wrong.
    for (const k of DECOMPOSED) {
      for (const c of k.comps) {
        assert.ok(componentStrokes(c) != null, `${k.c}: no strokes for "${c}"`);
      }
    }
  });

  // The 44 kanji whose component strokes miss the whole by more than ±3. Every
  // one is a KanjiVG artifact, NOT a wrong part: positive Δ = a surround emitted
  // once per child group (行/衣/囗/斉 …) or an otherwise duplicated part;
  // negative Δ = a partial depth-1 that named one element (先→儿, 鳥→灬). Pinned
  // as an exact set so a re-cut that mangles a NEW kanji's strokes — the
  // over-nesting a mis-decomposition looks like — breaks this test loudly.
  //
  // Was 66; 22 over-count artifacts are now corrected by COMPS_OVERRIDE (see
  // kanji.ts) and conserve within tolerance, so they left this set: the surround
  // splits 斎 黙 憩 衰 修 衷 哀 威 術 街 衛 衝 衡 裏 褒 戚 束 東, and the single-shape
  // splits 必 戒 氷 由. The 12 over-counts that REMAIN here are ones whose corrected
  // depth-1 list is still doubtful (謄 州 成 準 挿 曲 蔵 卵 …) — left for the owner,
  // not force-fixed. COMPS_OVER_COUNT_FIXED below pins the corrected side.
  const KNOWN_STROKE_ANOMALIES = new Set(
    // over-count (Δ > +3) still uncorrected: duplicated surround / repeated part
    ("謄随州成準挿曲蔵卵島畿章" +
      // under-count (Δ < −3): partial depth-1
      "僅先免共声展憲散瓦衆衣言谷豆赤鹿倉帥師慶段角飛無舞華薦遣馬骨麗鳥").split(""),
  );

  test("the set of gross mismatches is exactly the 44 documented artifacts", () => {
    const anomalies = new Set<string>();
    for (const k of DECOMPOSED) {
      const sum = k.comps.reduce((n, c) => n + (componentStrokes(c) ?? 0), 0);
      if (Math.abs(sum - k.strokes) > TOLERANCE) anomalies.add(k.c);
    }
    // Symmetric-difference report so a regression names the exact kanji.
    const appeared = [...anomalies].filter((c) => !KNOWN_STROKE_ANOMALIES.has(c));
    const gone = [...KNOWN_STROKE_ANOMALIES].filter((c) => !anomalies.has(c));
    assert.deepEqual(
      { appeared, gone },
      { appeared: [], gone: [] },
      "stroke-conservation anomaly set changed — review new/removed kanji",
    );
    assert.equal(anomalies.size, 44);
  });

  test("the overwhelming majority conserve within tolerance", () => {
    const within = DECOMPOSED.filter((k) => {
      const sum = k.comps.reduce((n, c) => n + (componentStrokes(c) ?? 0), 0);
      return Math.abs(sum - k.strokes) <= TOLERANCE;
    }).length;
    assert.equal(DECOMPOSED.length, 2068);
    assert.equal(within, 2024);
    assert.ok(within / DECOMPOSED.length >= 0.96, `${within}/${DECOMPOSED.length}`);
  });
});

describe("over-count corrections — no fixed kanji lists a part too many times", () => {
  // The over-count defects COMPS_OVERRIDE corrects, pinned as the corrected
  // depth-1 list. KanjiVG split ONE shape across two child groups and named it
  // once per side (国 [囗 玉 囗], 術 [行 朮 行], 斎 [斉 斉 示 斉], 五 [二 二]); the
  // override collapses each duplicate to its true count. This guard asserts two
  // things at once: comps now equals the corrected list, AND no component in it
  // repeats beyond what the corrected list allows — so a re-cut that reintroduces
  // the split, or over-collapses a genuine repeat, fails here.
  const CORRECTED: Record<string, string[]> = {
    // enclosure 囗 (one box, not two)
    囚: ["囗", "人"], 四: ["囗", "儿"], 回: ["囗", "口"], 因: ["囗", "大"],
    団: ["囗", "寸"], 困: ["囗", "木"], 囲: ["囗", "井"], 図: ["囗", "⺍", "乂"],
    固: ["囗", "古"], 国: ["囗", "玉"], 圏: ["囗", "巻"], 園: ["囗", "袁"],
    菌: ["艹", "囗", "禾"],
    // open-box 匚 / 匸
    匠: ["匚", "斤"], 区: ["匸", "乂"], 医: ["匸", "矢"], 匿: ["匸", "若"],
    匹: ["匸", "儿"],
    // 行 wrapping a phonetic
    術: ["行", "朮"], 街: ["行", "圭"], 衛: ["行", "韋"], 衝: ["行", "重"],
    衡: ["行", "𩵋"],
    // 衣 split top/bottom
    哀: ["衣", "口"], 衷: ["衣", "口", "丨"], 裏: ["衣", "里"], 褒: ["衣", "保"],
    衰: ["衣", "口", "口"],
    // 𢦏 frame
    栽: ["𢦏", "木"], 裁: ["𢦏", "衣"], 載: ["𢦏", "車"], 戴: ["𢦏", "異"],
    // 斉 wrapping 示
    斎: ["斉", "示"],
    // other single-shape splits
    可: ["丁", "口"], 吏: ["丈", "口"], 式: ["弋", "工"], 戒: ["戈", "廾"],
    戚: ["戊", "尗"], 威: ["戍", "女"], 憩: ["舌", "息"], 必: ["心", "丿"],
    黙: ["黒", "犬"], 修: ["攸", "彡"], 充: ["亠", "允"], 由: ["日", "丨"],
    東: ["木", "日"], 束: ["木", "口"], 氷: ["水", "丶"], 我: ["丿", "戈", "亅"],
    // number kanji
    五: ["二"], 年: ["丿", "干"], 午: ["丿", "干"],
  };

  test("every corrected kanji's comps equals its curated list", () => {
    for (const [c, expected] of Object.entries(CORRECTED)) {
      assert.deepEqual(kanjiRow(c)?.comps, expected, c);
    }
  });

  test("no corrected kanji repeats a component beyond its expected count", () => {
    for (const [c, expected] of Object.entries(CORRECTED)) {
      const allow = new Map<string, number>();
      for (const p of expected) allow.set(p, (allow.get(p) ?? 0) + 1);
      const got = new Map<string, number>();
      for (const p of kanjiRow(c)?.comps ?? []) got.set(p, (got.get(p) ?? 0) + 1);
      for (const [p, n] of got) {
        assert.ok(n <= (allow.get(p) ?? 0), `${c}: "${p}" appears ${n}×, over-count`);
      }
    }
  });
});

describe("classical-radical reachability — the Kangxi radical is in the closure", () => {
  // The recursive comps closure of a kanji: every component, and every component
  // of a component, as far as the data goes.
  const closureOf = (() => {
    const compsOf = new Map(KANJI.map((k) => [k.c, k.comps]));
    return (kanji: string): Set<string> => {
      const seen = new Set<string>();
      const stack = [...(compsOf.get(kanji) ?? [])];
      while (stack.length) {
        const c = stack.pop()!;
        if (seen.has(c)) continue;
        seen.add(c);
        for (const d of compsOf.get(c) ?? []) if (!seen.has(d)) stack.push(d);
      }
      return seen;
    };
  })();

  // A Kangxi radical is written, inside a glyph, as a bound COMPONENT FORM that
  // is a different codepoint from the standalone radical: radical 辵 is drawn ⻌,
  // radical 水 as 氵, radical 心 as 忄. This table (owned here, NOT the `variants`
  // map another owner holds) equates a radical glyph with the forms it appears
  // as in comps, so the check measures real reachability and not codepoint skew.
  // Without it, all ~60 辵 kanji read as false exceptions.
  const RADICAL_FORMS: Record<string, string[]> = {
    水: ["氵", "氺"], 心: ["忄", "㣺"], 手: ["扌"], 人: ["亻"], 刀: ["刂"],
    艸: ["艹"], 肉: ["月", "⺼"], 网: ["罒", "⺲"], 火: ["灬"], 犬: ["犭"],
    邑: ["⻏"], 阜: ["⻖"], 玉: ["王"], 辵: ["⻌", "辶"], 老: ["耂"],
    竹: ["⺮"], 衣: ["衤"], 示: ["礻"], 食: ["飠", "𩙿"], 金: ["釒"],
    糸: ["糹"], 言: ["訁"], 爪: ["爫", "⺥"], 母: ["毋"], 聿: ["⺻"],
    川: ["巛", "巜"],
  };

  function radicalReachable(kanji: string): boolean {
    const radGlyph = RADICAL_GLYPH.get(RADICAL_OF[kanji]);
    if (radGlyph == null) return false;
    const forms = new Set([radGlyph, ...(RADICAL_FORMS[radGlyph] ?? [])]);
    if (forms.has(kanji)) return true; // the kanji IS its own radical
    for (const c of closureOf(kanji)) {
      if (forms.has(c)) return true;
      // a variant form c whose original is the radical (or a form of it)
      const orig = variantOriginal(c);
      if (orig && (orig === radGlyph || (RADICAL_FORMS[radGlyph] ?? []).includes(orig))) {
        return true;
      }
    }
    return false;
  }

  // The 47 kanji whose Kangxi radical is genuinely NOT in their depth-1 shape —
  // radical-by-tradition, the expected residue. 由/甲/申 are radical 田 (field)
  // but drawn 日+丨; 世 is radical 一 drawn 廿; 来 is radical 木 drawn 米; 麦/黄/黒
  // are the modern forms of their own traditional radical (麥/黃/黑). All correct
  // as classifications; the depth-1 shape simply doesn't contain the radical.
  const KNOWN_RADICAL_EXCEPTIONS = new Set(
    "世主久亀修充光全再冒勝升単卵商夏奉奪奮密寧就巣巨帰常幸当彙戚戴承整来由甲申画畝築能采随騰麦黄黒".split(""),
  );

  test("the exception set is exactly the 47 radical-by-tradition kanji", () => {
    const exceptions = new Set(
      DECOMPOSED.filter((k) => !radicalReachable(k.c)).map((k) => k.c),
    );
    const appeared = [...exceptions].filter((c) => !KNOWN_RADICAL_EXCEPTIONS.has(c));
    const gone = [...KNOWN_RADICAL_EXCEPTIONS].filter((c) => !exceptions.has(c));
    assert.deepEqual(
      { appeared, gone },
      { appeared: [], gone: [] },
      "radical-reachability exception set changed — review new/removed kanji",
    );
    assert.equal(exceptions.size, 47);
  });

  test("the large majority reach their classical radical", () => {
    const reached = DECOMPOSED.filter((k) => radicalReachable(k.c)).length;
    assert.equal(reached, 2021);
    assert.ok(reached / DECOMPOSED.length >= 0.97, `${reached}/${DECOMPOSED.length}`);
  });
});

describe("pinned decomposition of the first 100 taught kanji", () => {
  // Generated from today's comps, then hand-checked one by one against the glyph.
  // Every listed component is genuinely part of its kanji — no 儿→八. 国 [囗 玉]
  // and 年 [丿 干] are the COMPS_OVERRIDE-corrected forms: KanjiVG shipped 国
  // [囗 玉 囗] (doubled enclosure) and 年 [丿 干 干] (repeated 干), and the override
  // collapses each duplicate — so the snapshot pins the corrected shape a learner
  // now sees. Several entries are still thin partials (先 [儿], 白 [日], 里 [日],
  // 言 [口]). A future re-cut that reshuffles any first-seen kanji fails here.
  const EXPECTED: Record<string, string[]> = {
    人: [], 大: [], 日: [], 一: [], 不: ["一", "丿", "丨"], 乙: [],
    乞: ["𠂉", "乙"], 気: ["气", "乂"], 山: [], 出: ["山", "凵"], 上: ["卜", "一"],
    生: [], 手: [], 口: [], 合: ["人", "一", "口"], 中: ["口", "丨"], 行: ["彳"],
    刀: [], 分: ["八", "刀"], 十: [], 干: ["十"], 年: ["丿", "干"], 入: [],
    下: ["一", "卜"], 立: ["亠"], 土: [], 地: ["土", "也"], 用: [], 弓: [],
    引: ["弓", "丨"], 目: [], 見: ["目", "儿"], 牛: [], 物: ["牛", "勿"], 子: [],
    尚: ["⺌", "冋"], 学: ["⺍", "冖", "子"], 白: ["日"], 的: ["白", "勺"], 王: [],
    国: ["囗", "玉"], 夕: [], 名: ["夕", "口"], 耳: [], 又: [],
    取: ["耳", "又"], 事: ["口", "⺕", "亅"], 力: [], 水: [], 二: [],
    会: ["人", "云"], 木: [], 化: ["亻", "匕"], 体: ["亻", "本"], 方: ["亠"],
    本: ["木"], 定: ["宀", "疋"], 切: ["七", "刀"], 心: [], 当: ["⺌", "⺕"],
    主: ["亠", "王"], 士: [], 実: ["宀", "𡗗"], 月: [], 明: ["日", "月"],
    外: ["夕", "卜"], 自: ["目"], 斤: [], 戸: [], 所: ["戸", "斤"],
    老: ["耂", "匕"], 者: ["耂", "日"], 長: [], 文: ["亠", "乂"], 金: [],
    何: ["亻", "可"], 直: ["十", "目"], 込: ["入", "⻌"], 作: ["亻", "乍"], 車: [],
    刈: ["乂", "刂"], 前: ["八", "月", "刂"], 通: ["甬", "⻌"], 発: ["癶", "二", "儿"],
    書: ["聿", "日"], 面: [], 食: [], 虫: ["中"], 風: ["几", "虫"], 里: ["日"],
    重: ["千", "里"], 小: [], 同: ["冂", "一", "口"], 言: ["口"], 内: ["冂", "人"],
    寸: [], 付: ["亻", "寸"], 止: ["卜"], 正: ["一", "止"], 先: ["儿"],
  };

  test("the snapshot covers exactly the first 100 in teaching order", () => {
    const first100 = KANJI_ORDER.slice(0, 100).map((o) => o.c);
    assert.equal(Object.keys(EXPECTED).length, 100);
    assert.deepEqual(Object.keys(EXPECTED), first100);
  });

  test("comps of each of the first 100 equals the hand-checked snapshot", () => {
    for (const [c, expected] of Object.entries(EXPECTED)) {
      assert.deepEqual(kanjiRow(c)?.comps, expected, c);
    }
  });
});

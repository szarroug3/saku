// Run: node --import ./src/lib/conjugate/test-hooks.mjs --test \
//        src/data/variant-forms.test.ts
//
// WHAT THESE PIN
// ==============
// The variant model is almost entirely derived, so what can go wrong is a piece
// of the derivation coming back empty or pointing at the wrong thing:
//
//   - a form with no worked example, which the lesson and the concept card both
//     rely on ("as in 体"). Every SHOWN form (the fifty-eight less the twelve
//     EXCLUDED as mislabels or un-nameable) must resolve one.
//   - an example that is the base character itself, which would teach 人 by
//     showing 人 rather than a second kanji.
//   - a curated example that does not actually contain the form, or that shows the
//     WRONG glyph — the 月/肉 case, where a comps scan cannot tell the flesh 月 from
//     the moon 月 and the derived pick 明 is the moon. The curated table fixes it,
//     and the "the curated examples" block below pins that it stays fixed.
//   - a position outside the six the panel knows how to phrase.
//   - the authored name and position tables keying to a glyph that is not a
//     variant form at all — a dead entry, or worse a typo for a real one.
//
// THE PINNED MAP (the guard this file exists for)
// ===============================================
// The `variants` map is KanjiVG's `kvg:original`, a community field that cannot
// validate itself and has shipped real mislabels (儿 called a form of 八, 日 of
// 曰, 川 of 巛). A COUNT-only test let those through. So the shape of the map is
// now pinned three ways, and any KanjiVG re-cut that adds, drops, or changes a
// mapping fails loudly and forces a human re-verification:
//
//   - EVERY_GLYPH — the exact 58 keys the ingest shipped.
//   - EXPECTED_VARIANT_ORIGIN — the authored, hand-verified glyph→original for
//     every KEPT (non-excluded) mapping, asserted equal to the map.
//   - EXCLUDED — the exact set of dropped mislabels / un-nameable forms.

import assert from "node:assert/strict";
import { describe, test } from "node:test";

import kanjiComponents from "@/data/generated/kanji-components.json" with { type: "json" };
import { kanjiEntry, kanjiRow } from "@/data/kanji";
import { variantForm, variantsOf, type VariantPosition } from "@/data/variant-forms";
import { builtFrom, libEntry } from "@/lib/library/entries";

const VARIANTS = (kanjiComponents as { variants: Record<string, string> }).variants;
const COMPS = (kanjiComponents as { comps: Record<string, string[]> }).comps;
const GLYPHS = Object.keys(VARIANTS);

// ---------------------------------------------------------------------------
// THE AUTHORED SOURCE OF TRUTH — every mapping, kept or dropped, decided by hand
// against Kangxi-radical and component-variant references (NOT by trusting the
// KanjiVG field, which is the source of the errors).
// ---------------------------------------------------------------------------

// The exact 58 keys the ingest ships. A re-cut that changes this set fails here.
const EVERY_GLYPH: ReadonlySet<string> = new Set([
  "⺌", "⺍", "⺕", "⺗", "⺤", "⺦", "⺨", "⺷", "⻌", "⻏", "⻖", "⻞", "㐮", "㑒",
  "㔾", "亻", "儿", "兹", "冫", "刂", "匸", "厶", "士", "夹", "寉", "川", "开",
  "忄", "戋", "戌", "戍", "扌", "攵", "斉", "旡", "日", "月", "歯", "毋", "氵",
  "氺", "灬", "王", "眞", "礻", "竜", "罒", "耂", "艹", "衤", "覀", "飠", "麦",
  "黒", "鼡", "𠂊", "𦥑", "𩵋",
]);

// The forms DROPPED from the teaching, with the reason each is not a true variant
// of its recorded original. `variantForm` returns undefined for these, and the
// component link/meaning path (madeOf → builtPieceMeaning) routes them to their
// own shape instead of the false original — pinned in the "built-from" block.
//
//   MISLABEL (false cross-character identity):
//     儿  にんにょう/ひとあし (legs), a radical of its own — NOT a form of 八 (eight).
//     士  さむらい (radical 33, scholar) — NOT a form of 土 (earth); 売 files under 士.
//     冫  にすい (ice, radical 15, from 冰) — NOT a form of 二 (two). The 冫 in 冷・冬
//         is the ice radical, not a reshaped 二.
//     日  日 (sun) is its own character — NOT a bottom-form of 曰 (say).
//     川  川 (river) is its own taught kanji and the primary river-radical form —
//         NOT a reduced form of the archaic curved variant 巛. Arrow points backwards.
//     戌  戌 (11th earthly branch, dog) and 戍 (to garrison) are DISTINCT characters
//     戍  differing by one stroke; the map swaps them as forms of each other.
//     ⺍  its recorded "original" is the HIRAGANA つ (U+3064), not a kanji at all.
//     厶  self-map (厶 → 厶): not a variant relationship.
//   NO ESTABLISHED NAME (rare glyph; naming would mean inventing; surface-#1, so a
//   table row would show a blank "Called"):
//     眞  kyūjitai of 真, not a radical; sole jōyō host 塡.
//     𦥑  rare Ext-B two-hands component conflated with 臼; sole host 興.
//     𩵋  rare Ext-B fish glyph, not the 魚 うおへん radical; sole host 衡.
const EXCLUDED: ReadonlySet<string> = new Set([
  "儿", "士", "冫", "日", "川", "戌", "戍", "⺍", "厶", "眞", "𦥑", "𩵋",
]);

// The hand-verified original for EVERY kept mapping — 46 of them. Each is a TRUE
// reshaping (radical form: 亻 of 人, 艹 of 艸) or modern↔old whole-character form
// (斉 of 齊, 麦 of 麥, 歯 of 齒). Asserted equal to the shipped map below.
const EXPECTED_VARIANT_ORIGIN: Readonly<Record<string, string>> = {
  "⺌": "小", // しょうがしら, top form of 小
  "⺕": "彑", // snout-radical form (radical 58 family)
  "⺗": "心", // したごころ, bottom form of 心
  "⺤": "爪", // つめかんむり, top form of 爪
  "⺦": "爿", // reduced form of 爿 (丬, radical 90)
  "⺨": "犬", // けものへん, left form of 犬
  "⺷": "羊", // ひつじ, top form of 羊
  "⻌": "辶", // しんにょう, a form of the walk radical
  "⻏": "邑", // おおざと, right form of 邑
  "⻖": "阜", // こざとへん, left form of 阜
  "⻞": "食", // しょくへん, the three-form eat radical, left of 食
  "㐮": "襄", // component/old form of 襄 (譲・嬢・壌・醸)
  "㑒": "僉", // shinjitai component form of 僉 (検・険・剣・験)
  "㔾": "卩", // variant of the seal radical 卩
  "亻": "人", // にんべん, left form of 人
  "兹": "茲", // variant of 茲 ("this")
  "刂": "刀", // りっとう, right form of 刀
  "匸": "匚", // hiding/box enclosure form (retained; see note below)
  "夹": "夾", // shinjitai form of 夾 (狭・挟・峡)
  "寉": "隺", // variant of the 隺 bird component (確・鶴)
  "开": "幵", // reduced form of 幵 (刑・形・研・開)
  "忄": "心", // りっしんべん, left form of 心
  "戋": "戔", // shinjitai form of 戔 (浅・残・銭・践・桟)
  "扌": "手", // てへん, left form of 手
  "攵": "攴", // ぼくづくり, the common form of the 攴 radical
  "斉": "齊", // shinjitai of 齊 (済・剤・斎)
  "旡": "无", // form of the 无 radical (radical 71, 既)
  "月": "肉", // にくづき, the flesh form of 肉
  "歯": "齒", // shinjitai of 齒 (齢)
  "毋": "母", // なかれ, form of the 母/毋 group
  "氵": "水", // さんずい, left form of 水
  "氺": "水", // したみず, bottom form of 水
  "灬": "火", // れっか, bottom form of 火
  "王": "玉", // おうへん, the left form of 玉 (coincides in shape with 王)
  "礻": "示", // しめすへん, left form of 示
  "竜": "龍", // shinjitai of 龍 (滝)
  "罒": "网", // あみがしら, top form of the net radical 网
  "耂": "老", // おいかんむり, top form of 老
  "艹": "艸", // くさかんむり, top form of 艸
  "衤": "衣", // ころもへん, left form of 衣
  "覀": "襾", // top form of the cover radical 襾 (要・票・覆)
  "飠": "食", // しょくへん, left form of 食
  "麦": "麥", // shinjitai of 麥 (麺)
  "黒": "黑", // shinjitai of 黑 (墨・黙)
  "鼡": "鼠", // abbreviated (ryakuji) form of 鼠 (猟)
  "𠂊": "勹", // top form of the wrap radical 勹 (急・免・争)
};

const EXPECTED_GLYPHS = Object.keys(EXPECTED_VARIANT_ORIGIN);
const SHOWN = GLYPHS.filter((g) => !EXCLUDED.has(g));
const POSITIONS: ReadonlySet<VariantPosition> = new Set<VariantPosition>([
  "left",
  "right",
  "top",
  "bottom",
  "nyo",
  "tare",
]);

describe("the pinned variant map — a KanjiVG re-cut cannot change it silently", () => {
  test("the map is exactly the fifty-eight keys it shipped with", () => {
    // Not a count — the exact SET. Add, drop, or rename any key and this fails,
    // forcing the new mapping to be re-verified before it can teach anything.
    assert.deepEqual(new Set(GLYPHS), EVERY_GLYPH);
    assert.equal(GLYPHS.length, 58);
  });

  test("EXCLUDED is exactly the identified mislabels and un-nameable forms", () => {
    // Every excluded glyph is genuinely in the map (no stale exclusion), and the
    // set is exactly the twelve the audit dropped — no more, no fewer.
    for (const glyph of EXCLUDED) {
      assert.ok(VARIANTS[glyph], `${glyph} is excluded but not even in the map`);
    }
    assert.equal(EXCLUDED.size, 12);
    assert.deepEqual(
      new Set([...EXCLUDED]),
      new Set(["儿", "士", "冫", "日", "川", "戌", "戍", "⺍", "厶", "眞", "𦥑", "𩵋"]),
    );
  });

  test("kept and excluded together partition the fifty-eight", () => {
    // No glyph is both authored-expected and excluded, and every shipped key is
    // one or the other — so the audit covers all 58, none twice.
    for (const g of EXPECTED_GLYPHS) assert.ok(!EXCLUDED.has(g), `${g} both kept and excluded`);
    assert.equal(EXPECTED_GLYPHS.length + EXCLUDED.size, 58);
    assert.deepEqual(new Set([...EXPECTED_GLYPHS, ...EXCLUDED]), EVERY_GLYPH);
  });

  test("every kept mapping equals its hand-verified original", () => {
    // The heart of the guard: the shipped `variants[glyph]` must match the value
    // the audit authored. A KanjiVG re-cut that repoints 亻 away from 人, or 月
    // away from 肉, fails right here.
    for (const glyph of EXPECTED_GLYPHS) {
      assert.equal(
        VARIANTS[glyph],
        EXPECTED_VARIANT_ORIGIN[glyph],
        `${glyph} maps to ${VARIANTS[glyph]}, expected ${EXPECTED_VARIANT_ORIGIN[glyph]}`,
      );
    }
    // And the kept set is exactly the non-excluded shipped keys.
    assert.deepEqual(new Set(EXPECTED_GLYPHS), new Set(SHOWN));
  });
});

describe("variantForm — the derived model of one form", () => {
  test("every non-excluded form resolves to its original", () => {
    for (const glyph of SHOWN) {
      const form = variantForm(glyph);
      assert.ok(form, `${glyph} resolves no form`);
      assert.equal(form!.original, VARIANTS[glyph]);
    }
  });

  test("an EXCLUDED form resolves to nothing, so it is never shown", () => {
    // The rule: a variant is taught only when the pairing is true (and, in a
    // table, nameable). Dropping the mislabels is what removes both the blank
    // "Called" rows (儿 on 八's page) and the false "Built from" notes (日 on 白's).
    for (const glyph of EXCLUDED) {
      assert.ok(VARIANTS[glyph], `${glyph} is not even in the map — stale exclusion`);
      assert.equal(variantForm(glyph), undefined, `${glyph} is excluded but still resolves`);
    }
  });

  test("八 has no variant form, so its page shows no 'Also written as'", () => {
    assert.equal(variantForm("儿"), undefined);
    assert.deepEqual(variantsOf("八"), []);
  });

  test("曰 gains no form and 白's 日 is a plain 日 (the 日→曰 mislabel)", () => {
    // 日 (sun) is its own character, not a bottom-form of 曰 (say). Dropping it
    // means 白's "Built from" shows plain 日, and 曰 groups no forms.
    assert.equal(variantForm("日"), undefined);
    assert.deepEqual(variantsOf("曰"), []);
  });

  test("巛 gains no form (the 川→巛 mislabel)", () => {
    // 川 (river) is its own taught kanji; the 川 in 訓・順・州 is plain 川.
    assert.equal(variantForm("川"), undefined);
    assert.deepEqual(variantsOf("巛"), []);
  });

  test("the 戌/戍 confusion resolves to nothing in either direction", () => {
    assert.equal(variantForm("戌"), undefined);
    assert.equal(variantForm("戍"), undefined);
    assert.deepEqual(variantsOf("戍"), []);
    assert.deepEqual(variantsOf("戌"), []);
  });

  test("every non-excluded form resolves a worked example, and it is a second kanji", () => {
    for (const glyph of SHOWN) {
      const form = variantForm(glyph)!;
      assert.ok(form.example, `${glyph} resolves no example`);
      assert.ok(
        (kanjiRow(form.example!)?.comps ?? []).includes(glyph),
        `${form.example} does not contain ${glyph}`,
      );
      assert.notEqual(form.example, form.original, `${glyph}'s example is its own original`);
    }
  });

  test("every non-excluded form has a position, and it is one the panel can phrase", () => {
    for (const glyph of SHOWN) {
      const pos = variantForm(glyph)!.position;
      assert.ok(pos, `${glyph} has no position`);
      assert.ok(POSITIONS.has(pos!), `${glyph} has an unphrasable position ${pos}`);
    }
  });

  test("a plain character is not a variant form", () => {
    assert.equal(variantForm("山"), undefined);
    assert.equal(variantForm("人"), undefined); // the ORIGINAL is not itself a form
  });

  test("the authored names land on real forms, with the well-known ones correct", () => {
    for (const glyph of SHOWN) {
      const name = variantForm(glyph)!.name;
      if (name !== undefined) assert.ok(VARIANTS[glyph], `${glyph} is named but is not a form`);
    }
    assert.equal(variantForm("亻")!.name, "にんべん");
    assert.equal(variantForm("氵")!.name, "さんずい");
    assert.equal(variantForm("忄")!.name, "りっしんべん");
  });

  test("亻 is 人, on the left, called にんべん, shown in 体", () => {
    const form = variantForm("亻")!;
    assert.equal(form.original, "人");
    assert.equal(form.position, "left");
    assert.equal(form.name, "にんべん");
    assert.equal(form.example, "体");
  });
});

describe("the built-from label respects the exclusion set — no mislabel leaks", () => {
  // The link/meaning path (madeOf → builtPieceMeaning) reads the RAW map through
  // variantTaughtKanji, a separate route from variantForm. Left unguarded it
  // printed a 儿 tile as "eight" (its false original 八) while 儿's own radical
  // page says "legs". The fix makes that path consult isExcludedVariant, so an
  // excluded glyph shows its OWN shape. These pin that no excluded glyph's tile
  // ever carries its false original's meaning.

  /** The "Built from" piece for `glyph` inside a host that actually contains it,
   * or undefined when no taught host does. */
  function builtPiece(glyph: string) {
    for (const [host, comps] of Object.entries(COMPS)) {
      if (!comps.includes(glyph)) continue;
      if (!kanjiRow(host)) continue;
      const entry = libEntry(kanjiEntry(host));
      if (!entry) continue;
      const piece = builtFrom(entry).find((p) => p.c === glyph);
      if (piece) return piece;
    }
    return undefined;
  }

  test("四's 儿 tile reads its own meaning 'legs', never the false 'eight'", () => {
    const entry = libEntry(kanjiEntry("四"))!;
    const piece = builtFrom(entry).find((p) => p.c === "儿");
    assert.ok(piece, "四 has no 儿 piece in its Built from");
    assert.equal(piece!.meaning, "legs");
    assert.notEqual(piece!.meaning, "eight");
    // And it carries no variant note pointing at 八.
    assert.equal(piece!.variant, undefined);
  });

  test("a 士 tile reads its own meaning, never the false original 'earth'", () => {
    // 士 is itself a taught kanji, so its piece links to 士 and shows 士's own
    // gloss — it never resolved through the 士→土 mislabel. The guard confirms it.
    const piece = builtPiece("士");
    assert.ok(piece, "no taught host renders a 士 built-from piece");
    assert.equal(piece!.meaning, "gentleman");
    assert.notEqual(piece!.meaning, "earth");
    assert.equal(piece!.variant, undefined);
  });

  test("no excluded glyph's built-from tile carries its false original's meaning", () => {
    for (const glyph of EXCLUDED) {
      const piece = builtPiece(glyph);
      if (!piece) continue; // no taught host renders it — cannot leak
      const originalMeaning = kanjiRow(VARIANTS[glyph])?.meanings[0];
      if (originalMeaning !== undefined) {
        assert.notEqual(
          piece.meaning,
          originalMeaning,
          `${glyph}'s tile leaked the false original ${VARIANTS[glyph]} (${originalMeaning})`,
        );
      }
      // An excluded glyph is never dressed as a variant of anything.
      assert.equal(piece.variant, undefined, `${glyph}'s tile still carries a variant note`);
    }
  });

  test("a KEPT variant still links and notes through its original (亻 → 人)", () => {
    // The guard must not over-fire: a legitimate form keeps its variant note.
    const entry = libEntry(kanjiEntry("休"))!; // 休 = 亻 + 木
    const piece = builtFrom(entry).find((p) => p.c === "亻");
    assert.ok(piece, "休 has no 亻 piece");
    assert.equal(piece!.meaning, "person"); // 人's meaning, reached through the variant
    assert.equal(piece!.variant?.original, "人");
    assert.equal(piece!.variant?.name, "にんべん");
  });
});

describe("the curated examples win over the earliest-by-order default", () => {
  /** The 27 surface-#1 forms — the ones whose original is a taught character, and
   * so the only ones whose example a learner ever sees. Read off the data. */
  const kanjiSet = new Set(
    Object.values(VARIANTS).filter((original) => kanjiRow(original)),
  );
  const surfaceOne = GLYPHS.filter((g) => kanjiSet.has(VARIANTS[g]));
  const excludedSurfaceOne = surfaceOne.filter((g) => EXCLUDED.has(g));
  const shownSurfaceOne = surfaceOne.filter((g) => !EXCLUDED.has(g));

  test("the 27 surface-#1 forms split into 21 shown and 6 excluded", () => {
    // The six excluded surface-#1 forms are 儿, 士, 冫, 眞, 𦥑, 𩵋 — the ones whose
    // false/absent name would show a blank "Called". The other six exclusions
    // (日, 川, 戌, 戍, ⺍, 厶) are NOT surface-#1: their original is untaught, so
    // they only ever appeared as a "Built from" note.
    assert.equal(surfaceOne.length, 27);
    assert.equal(shownSurfaceOne.length, 21);
    assert.deepEqual(
      new Set(excludedSurfaceOne),
      new Set(["儿", "士", "冫", "眞", "𦥑", "𩵋"]),
    );
    for (const glyph of excludedSurfaceOne) {
      assert.equal(variantForm(glyph), undefined, `${glyph} is excluded but resolves`);
    }
  });

  test("every SHOWN surface-#1 form has a non-empty name — no blank 'Called'", () => {
    for (const glyph of shownSurfaceOne) {
      const name = variantForm(glyph)!.name;
      assert.ok(name && name.length > 0, `${glyph} is shown but has no name`);
    }
  });

  test("all 21 shown surface-#1 forms have a curated example that they truly contain", () => {
    for (const glyph of shownSurfaceOne) {
      const example = variantForm(glyph)!.example;
      assert.ok(example, `${glyph} resolves no example`);
      assert.ok(
        (kanjiRow(example!)?.comps ?? []).includes(glyph),
        `${glyph}'s example ${example} does not contain it as a component`,
      );
    }
  });

  test("newly named forms carry their verified name", () => {
    assert.equal(variantForm("⺌")!.name, "しょうがしら");
    assert.equal(variantForm("⺤")!.name, "つめかんむり");
    assert.equal(variantForm("⺷")!.name, "ひつじ");
    assert.equal(variantForm("⻞")!.name, "しょくへん");
    assert.equal(variantForm("氺")!.name, "したみず");
    assert.equal(variantForm("毋")!.name, "なかれ");
  });

  test("the familiar picks replace the earliest-by-order defaults", () => {
    assert.equal(variantForm("亻")!.example, "体");
    assert.equal(variantForm("氵")!.example, "海");
    assert.equal(variantForm("忄")!.example, "情");
    assert.equal(variantForm("扌")!.example, "持");
  });

  test("THE BUG: 月 (a form of 肉) shows a FLESH kanji, not the moon 明", () => {
    const form = variantForm("月")!;
    assert.equal(form.original, "肉");
    assert.notEqual(form.example, "明", "月's example is the MOON kanji");
    assert.equal(form.example, "腹"); // belly — a flesh 月 on the left
    assert.ok((kanjiRow(form.example!)?.comps ?? []).includes("月"));
  });
});

describe("variantsOf — the forms a character takes", () => {
  test("人 takes exactly 亻", () => {
    assert.deepEqual(variantsOf("人").map((f) => f.glyph), ["亻"]);
  });

  test("心 takes two forms, the left one listed before the one underneath", () => {
    const forms = variantsOf("心");
    assert.deepEqual(forms.map((f) => f.glyph), ["忄", "⺗"]);
    assert.equal(forms[0]!.position, "left");
    assert.equal(forms[1]!.position, "bottom");
  });

  test("水 and 食 each take two forms as well", () => {
    assert.equal(variantsOf("水").length, 2);
    assert.equal(variantsOf("食").length, 2);
  });

  test("a character with no form on file takes none", () => {
    assert.deepEqual(variantsOf("山"), []);
    assert.deepEqual(variantsOf("亻"), []);
  });

  test("every original groups back the forms that name it", () => {
    for (const glyph of SHOWN) {
      const original = VARIANTS[glyph];
      assert.ok(
        variantsOf(original).some((f) => f.glyph === glyph),
        `${glyph} is missing from variantsOf(${original})`,
      );
    }
    for (const glyph of EXCLUDED) {
      const original = VARIANTS[glyph];
      assert.ok(
        !variantsOf(original).some((f) => f.glyph === glyph),
        `${glyph} is excluded but still groups under ${original}`,
      );
    }
  });
});

// Run: node --test src/data/radical-tips.test.ts
//
// SAK-155: hand-authored radical recognition tips. Two shapes:
//   - RADICAL_CONFUSABLE_PAIRS (口/囗, 日/曰) — a shared tip that must resolve
//     from EITHER glyph's side, and must NOT fire for a glyph that merely
//     happens to sit next to one of the pair on some unrelated page.
//   - RADICAL_TIPS (勹) — a single-glyph recognition tip, looked up by glyph
//     alone, no partner involved.

import assert from "node:assert/strict";
import test, { describe } from "node:test";

import {
  RADICAL_CONFUSABLE_PAIRS,
  RADICAL_TIPS,
  radicalConfusablePartner,
  radicalConfusableTip,
  radicalTipFor,
} from "./radical-tips.ts";

describe("radicalConfusablePartner", () => {
  test("resolves from EITHER side of the 口/囗 pair, same tip text", () => {
    const fromMouth = radicalConfusablePartner("口");
    const fromEnclosure = radicalConfusablePartner("囗");
    assert.ok(fromMouth, "口 should have a partner");
    assert.ok(fromEnclosure, "囗 should have a partner");
    assert.equal(fromMouth!.glyph, "囗");
    assert.equal(fromEnclosure!.glyph, "口");
    assert.equal(fromMouth!.tip, fromEnclosure!.tip);
    // The tip names both glyphs, so it reads correctly from either page.
    assert.match(fromMouth!.tip, /口/);
    assert.match(fromMouth!.tip, /囗/);
  });

  test("resolves from EITHER side of the 日/曰 pair, same tip text", () => {
    const fromSun = radicalConfusablePartner("日");
    const fromSay = radicalConfusablePartner("曰");
    assert.ok(fromSun, "日 should have a partner");
    assert.ok(fromSay, "曰 should have a partner");
    assert.equal(fromSun!.glyph, "曰");
    assert.equal(fromSay!.glyph, "日");
    assert.equal(fromSun!.tip, fromSay!.tip);
    assert.match(fromSun!.tip, /日/);
    assert.match(fromSun!.tip, /曰/);
  });

  test("a glyph with no authored pair (勹, or an arbitrary kanji) has no partner", () => {
    assert.equal(radicalConfusablePartner("勹"), undefined);
    assert.equal(radicalConfusablePartner("目"), undefined);
  });
});

describe("radicalConfusableTip", () => {
  test("order-independent for a real pair", () => {
    const a = radicalConfusableTip("口", "囗");
    const b = radicalConfusableTip("囗", "口");
    assert.ok(a);
    assert.equal(a, b);
  });

  test("undefined for glyphs that are not each other's partner — no false positive leak", () => {
    // 目 sits alongside 日 on an unrelated, pre-existing kanji lookalike pairing
    // (src/data/confusable.ts). It must NOT pick up 日's radical-pair tip with
    // 曰 just because 日 is involved on both sides.
    assert.equal(radicalConfusableTip("日", "目"), undefined);
    assert.equal(radicalConfusableTip("口", "日"), undefined);
    assert.equal(radicalConfusableTip("勹", "口"), undefined);
  });
});

describe("radicalTipFor", () => {
  test("勹 has an authored tip mentioning its own examples", () => {
    const tip = radicalTipFor("勹");
    assert.ok(tip);
    assert.match(tip!, /包/);
    assert.match(tip!, /勺/);
  });

  test("a glyph with no authored single-radical tip returns undefined", () => {
    assert.equal(radicalTipFor("口"), undefined);
    assert.equal(radicalTipFor("囗"), undefined);
  });
});

test("every pair glyph and every tip glyph is non-empty, single-character", () => {
  for (const pair of RADICAL_CONFUSABLE_PAIRS) {
    assert.equal([...pair.a].length, 1, `${pair.a} should be one character`);
    assert.equal([...pair.b].length, 1, `${pair.b} should be one character`);
    assert.ok(pair.tip.length > 0);
  }
  for (const t of RADICAL_TIPS) {
    assert.equal([...t.glyph].length, 1, `${t.glyph} should be one character`);
    assert.ok(t.tip.length > 0);
  }
});

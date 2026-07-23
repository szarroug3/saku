// Run: node --import ./src/lib/conjugate/test-hooks.mjs --test \
//   src/lib/character-role.test.ts
//
// The three role labels, checked against the real tables. The label is what the
// lesson card and the entry page both print, so its three cases — both, radical-
// only, kanji-only — have to be exactly the owner's three, off real characters.

import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { characterRole } from "./character-role.ts";
import { RADICALS, radicalByGlyph } from "../data/radicals.ts";
import { KANJI, kanjiRow } from "../data/kanji.ts";

describe("characterRole", () => {
  test("a character that is both a radical and a kanji reads 'radical · kanji'", () => {
    // 乙 (radical 5, and a jōyō kanji) is the owner's own example; 人 and 大 too.
    for (const g of ["乙", "人", "大"]) {
      assert.equal(characterRole(g), "radical · kanji", `${g} is both`);
    }
    // And so are the 8 both-role characters taught with an early radical card —
    // being taught twice does not change what they ARE.
    for (const g of ["火", "玉"]) {
      assert.equal(characterRole(g), "radical · kanji", `${g} is both`);
    }
  });

  test("a radical-only shape reads 'radical'", () => {
    // 气 (steam) is the shape 気 is built around, and is not itself a kanji.
    assert.equal(characterRole("气"), "radical");
  });

  test("a kanji that is not a radical reads 'kanji'", () => {
    // 乞 (beg) is a jōyō kanji filed under a radical it is not.
    assert.equal(characterRole("乞"), "kanji");
  });

  test("something that is neither reads null", () => {
    // A kana is neither a radical nor a kanji, so it has no role label.
    assert.equal(characterRole("あ"), null);
  });

  test("the three cases partition every radical and kanji glyph, off the data", () => {
    // No number, no count, no fourth answer: every radical glyph is "radical" or
    // "radical · kanji", every kanji glyph is "kanji" or "radical · kanji", and
    // the label agrees with plain glyph membership.
    for (const r of RADICALS) {
      const both = kanjiRow(r.glyph) !== undefined;
      assert.equal(characterRole(r.glyph), both ? "radical · kanji" : "radical");
    }
    for (const k of KANJI) {
      const both = radicalByGlyph(k.c) !== undefined;
      assert.equal(characterRole(k.c), both ? "radical · kanji" : "kanji");
    }
  });
});

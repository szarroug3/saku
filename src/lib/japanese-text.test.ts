// Run: node --test --experimental-strip-types \
//        --import ./src/lib/conjugate/test-hooks.mjs src/lib/japanese-text.test.ts
//
// WHAT THESE TESTS ARE FOR
// ========================
// hasJapanese decides which glyph slots get the theme's --font-kana. The
// failure it replaced was silent — a kanji headword rendered in a font with no
// CJK coverage and macOS quietly substituted a face of its own choosing — so
// nothing about it is visible in a diff. These tests pin the boundary from both
// sides: every writing system the app actually shows says yes, and the three
// strings that must stay in the UI face say no.

import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { hasJapanese, japaneseFontClass } from "./japanese-text.ts";

describe("hasJapanese", () => {
  test("says yes to every script the app prints", () => {
    for (const s of [
      "あ", // hiragana
      "ア", // katakana
      "人", // han
      "学生", // a word
      "ラーメン", // the prolonged sound mark rides along
      "人々", // the repeat mark rides along
      "〜てから", // a grammar pattern, wave dash
      "～すぎる", // and the full-width tilde spelling
    ]) {
      assert.equal(hasJapanese(s), true, s);
    }
  });

  test("says no to the strings that must keep the UI face", () => {
    for (const s of [
      "shi", // a romaji reading
      "Counter", // a Terms shelf entry name
      "Pitch accent",
      "▲", // the practice picker's shaky tile
      "", // an entry with no glyph at all
      "5",
    ]) {
      assert.equal(hasJapanese(s), false, s);
    }
  });

  test("counts a mixed string as Japanese, so a headword gets one face", () => {
    assert.equal(hasJapanese("〜すぎる (too much)"), true);
  });
});

describe("japaneseFontClass", () => {
  test("hands back a class only for Japanese", () => {
    assert.equal(japaneseFontClass("日"), "font-kana");
    assert.equal(japaneseFontClass("Romaji"), "");
  });
});

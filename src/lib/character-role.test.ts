// Run: node --import ./src/lib/conjugate/test-hooks.mjs --test \
//   src/lib/character-role.test.ts
//
// The role sets, checked against the real tables. The label is what the lesson
// card, the role badge and the entry page all print, so the cases the owner
// named — all three roles, kanji + word, radical only, kanji only, and the two
// kinds of nothing — have to come out right off real characters.

import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  characterRole,
  characterRoleTitle,
  characterRoles,
  playsRadicalRole,
} from "./character-role.ts";
import { CURRICULUM_WORDS } from "./word-lesson.ts";
import { RADICALS, radicalByGlyph } from "../data/radicals.ts";
import { KANJI, kanjiRow } from "../data/kanji.ts";

describe("characterRole", () => {
  test("a character that is radical, kanji and a word reads all three", () => {
    // 山 is Kangxi radical 46, a jōyō kanji, and the word やま on its own.
    assert.deepEqual(characterRoles("山"), ["radical", "kanji", "word"]);
    assert.equal(characterRole("山"), "radical · kanji · word");
    assert.equal(characterRoleTitle("山"), "Radical · Kanji · Word");
  });

  test("a kanji that is a word but no radical reads 'kanji · word'", () => {
    // 何 (なに) is a word you can say by itself; it is not a Kangxi radical.
    assert.equal(characterRole("何"), "kanji · word");
    assert.equal(characterRoleTitle("何"), "Kanji · Word");
  });

  test("a radical-only shape reads 'radical'", () => {
    // 气 (steam) is the shape 気 is built around, and is not itself a kanji.
    assert.equal(characterRole("气"), "radical");
    assert.equal(characterRoleTitle("气"), "Radical");
  });

  test("a kanji that is neither a radical nor a word reads 'kanji'", () => {
    // 乞 (beg) is a jōyō kanji filed under a radical it is not, and the words
    // track never teaches it alone.
    assert.equal(characterRole("乞"), "kanji");
    assert.equal(characterRoleTitle("乞"), "Kanji");
  });

  test("a radical that is a kanji is not thereby a word", () => {
    // 乙 is Kangxi radical 5 and a jōyō kanji, and the words track never hands it
    // over as a word of its own — the case the badge copy used to overclaim. 支
    // and 斗 are the same story.
    for (const g of ["乙", "支", "斗"]) {
      assert.equal(characterRole(g), "radical · kanji", `${g} is no word`);
      assert.equal(characterRoleTitle(g), "Radical · Kanji");
    }
  });

  test("a kana has no roles at all", () => {
    // Even though で and と are one-character words: a kana is not what this
    // label is about, so it gets no blob and no tag.
    for (const g of ["あ", "で", "と"]) {
      assert.equal(characterRole(g), null, `${g} has no role`);
      assert.deepEqual(characterRoles(g), []);
      assert.equal(characterRoleTitle(g), null);
    }
  });

  test("a multi-character word has no roles", () => {
    // The word role is for a glyph that is a word BY ITSELF; 火山 is two glyphs,
    // and neither the string nor a grammar pattern gets a role.
    assert.equal(characterRole("火山"), null);
    assert.equal(characterRole("〜てから"), null);
  });

  test("the roles are always printed radical, then kanji, then word", () => {
    for (const g of ["山", "何", "气", "乞", "乙", "人", "大", "火", "玉"]) {
      const roles = characterRoles(g);
      const order = ["radical", "kanji", "word"];
      const seen = roles.map((r) => order.indexOf(r));
      assert.deepEqual(seen, [...seen].sort((a, b) => a - b), `${g} in order`);
    }
  });

  test("the label agrees with plain membership, over every glyph in the data", () => {
    const oneCharWords = new Set(
      CURRICULUM_WORDS.map((w) => w.keb).filter(
        (keb) => [...keb].length === 1 && /\p{Script=Han}/u.test(keb),
      ),
    );
    const glyphs = new Set([
      ...RADICALS.map((r) => r.glyph),
      ...KANJI.map((k) => k.c),
      ...oneCharWords,
    ]);
    for (const g of glyphs) {
      const want: string[] = [];
      if (radicalByGlyph(g) !== undefined) want.push("radical");
      if (kanjiRow(g) !== undefined) want.push("kanji");
      if (oneCharWords.has(g)) want.push("word");
      assert.deepEqual(characterRoles(g), want, `roles of ${g}`);
      assert.equal(characterRole(g), want.join(" · "), `label of ${g}`);
    }
  });

  test("every one-character word in the curriculum is a jōyō kanji", () => {
    // 595 of them, and the reason the badge's two kanji-less word sets cannot
    // happen today: the words track is written entirely in jōyō kanji, so the
    // word role never turns up without the kanji role beside it.
    const wordKanji = [...KANJI.map((k) => k.c)].filter((c) =>
      characterRoles(c).includes("word"),
    );
    assert.equal(wordKanji.length, 595);
    for (const w of CURRICULUM_WORDS) {
      if ([...w.keb].length !== 1 || !/\p{Script=Han}/u.test(w.keb)) continue;
      assert.ok(kanjiRow(w.keb) !== undefined, `${w.keb} has a kanji card`);
    }
  });

  test("playsRadicalRole is radical membership, whatever else the glyph is", () => {
    assert.ok(playsRadicalRole("山"));
    assert.ok(playsRadicalRole("气"));
    assert.ok(!playsRadicalRole("何"));
    assert.ok(!playsRadicalRole("あ"));
  });
});

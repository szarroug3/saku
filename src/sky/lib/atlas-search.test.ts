// The other collections' matches, and the order they are drawn in (SAK-475).

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { alsoFound } from "./atlas-search";
import type { SkyItem, SkyKind } from "./types";

/** The shelves, in the order the rail reads down. */
const SHELVES: readonly SkyKind[] = ["kana", "radical", "kanji", "word", "counter", "grammar", "sentence", "verbPair", "keigo", "term"];

const item = (id: string, glyph: string, kind: SkyKind): SkyItem => ({ id, kind, glyph, english: id, standing: "not-seen" });

/** What Sam's search came back with: を on Kana, Words and Grammar. */
const wo = [
  { kind: "kana" as const, items: [item("kana:を", "を", "kana")] },
  { kind: "word" as const, items: [item("word:男", "男", "word"), item("word:女", "女", "word")] },
  { kind: "grammar" as const, items: [item("grammar:wo-place", "〜を + place", "grammar"), item("grammar:wo", "〜を", "grammar")] },
];

const names = (groups: ReturnType<typeof alsoFound>) => groups.map((g) => g.kind);
const glyphs = (groups: ReturnType<typeof alsoFound>, kind: SkyKind) => groups.find((g) => g.kind === kind)!.items.map((it) => it.glyph);

describe("the other collections' matches", () => {
  it("leads with Grammar when the query is kana", () => {
    // を is a particle, and a particle is what a beginner types kana to look
    // up. Sam typed を under Sentences and the 〜を page was on a chip.
    assert.deepEqual(names(alsoFound(wo, SHELVES, "を")), ["grammar", "kana", "word"]);
  });

  it("puts the pattern whose written form was typed at the front of its group", () => {
    // 〜を is the page を was typed for; 〜を + place is not, however the
    // search happened to rank the two.
    assert.deepEqual(glyphs(alsoFound(wo, SHELVES, "を"), "grammar"), ["〜を", "〜を + place"]);
  });

  it("leaves everything else in the order the search gave it", () => {
    assert.deepEqual(glyphs(alsoFound(wo, SHELVES, "を"), "word"), ["男", "女"]);
  });

  it("reads down the shelves when the query is not kana", () => {
    // 日 is a character, not something with a particle behind it, so the
    // collections come in the order the rail has them.
    const hi = [
      { kind: "word" as const, items: [item("word:日本", "日本", "word")] },
      { kind: "grammar" as const, items: [item("grammar:x", "〜日", "grammar")] },
      { kind: "kanji" as const, items: [item("kanji:日", "日", "kanji")] },
    ];
    assert.deepEqual(names(alsoFound(hi, SHELVES, "日")), ["kanji", "word", "grammar"]);
  });

  it("reads down the shelves for an English query too", () => {
    const north = [
      { kind: "grammar" as const, items: [item("grammar:y", "〜へ", "grammar")] },
      { kind: "kana" as const, items: [item("kana:へ", "へ", "kana")] },
    ];
    assert.deepEqual(names(alsoFound(north, SHELVES, "toward")), ["kana", "grammar"]);
  });

  it("takes the placeholder off either end of a pattern", () => {
    // 〜ば carries it in front; a pattern written the other way round is the
    // same match once the mark is off it.
    const ba = [{ kind: "grammar" as const, items: [item("g:ba-long", "〜ば〜ほど", "grammar"), item("g:ba", "〜ば", "grammar")] }];
    assert.deepEqual(glyphs(alsoFound(ba, SHELVES, "ば"), "grammar"), ["〜ば", "〜ば〜ほど"]);
  });

  it("keeps a collection nothing names last rather than first", () => {
    // an id the shelves do not carry sorts to the end, where an unplaced
    // thing belongs; -1 from indexOf would have put it in front of Kana
    const odd = [
      { kind: "verbPair" as const, items: [item("vp:1", "開く / 開ける", "verbPair")] },
      { kind: "kana" as const, items: [item("kana:あ", "あ", "kana")] },
    ];
    assert.deepEqual(names(alsoFound(odd, ["kana", "grammar"], "あ")), ["kana", "verbPair"]);
  });

  it("draws a pattern once when two collections hold it", () => {
    // 〜を is on Grammar and on Sentences, and it is one page
    const both = [...wo, { kind: "sentence" as const, items: [item("grammar:wo", "〜を", "grammar")] }];
    assert.deepEqual(names(alsoFound(both, SHELVES, "を")), ["grammar", "kana", "word"]);
  });

  it("answers nothing for nothing", () => {
    assert.deepEqual(alsoFound([], SHELVES, "を"), []);
  });
});

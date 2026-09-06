// Practice's adapter: what a recipe resolves to, and which asks a pool
// carries. The "reading in a word" ask is the one that was never lit
// (Sam, 2026-09-05): a kanji's word-anchored readings are its own facts,
// gated on the learner having met a word that carries them.

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { EMPTY_RECIPE } from "@/sky/lib/practice";

import { askOf, practiceCollections, practiceDraw, practicePreview } from "./practice";
import { sampleHistory } from "./sample-learner";

const NOW = Date.UTC(2026, 8, 5);

describe("practicePreview", () => {
  const history = sampleHistory(NOW);

  it("lights the reading-in-a-word ask once a kanji's word has been met", () => {
    const preview = practicePreview(history, { ...EMPTY_RECIPE, collections: ["kanji"], size: "all" }, {}, NOW);
    assert.equal(preview.asksAvailable["reading-in-word"], true);
    const inWord = preview.items.flatMap((p) => p.facts).filter((f) => /^kanji:.\/reading@../.test(f));
    assert.ok(inWord.length > 0);
  });

  it("never asks a kanji how it is said on its own", () => {
    const preview = practicePreview(history, { ...EMPTY_RECIPE, collections: ["kanji"], asks: ["reading"], size: "all" }, {}, NOW);
    assert.equal(preview.asksAvailable.reading, false);
    assert.equal(preview.matched, 0);
  });

  it("previews the whole pool, shakiest first, up to the cap", () => {
    const preview = practicePreview(history, { ...EMPTY_RECIPE, size: 5 }, {}, NOW);
    assert.ok(preview.items.length > 5);
    assert.ok(preview.matched >= preview.items.length);
    const misses = preview.items.map((p) => p.misses);
    assert.deepEqual([...misses].sort((a, b) => b - a), misses);
  });

  it("draws the size asked for at random from the pool, less the drops", () => {
    const recipe = { ...EMPTY_RECIPE, collections: ["kana"], size: 5 as const };
    const pool = practicePreview(history, recipe, {}, NOW).items;
    const dropped = [pool[0].item.id];
    let seed = 7;
    const random = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    const drawn = practiceDraw(history, recipe, {}, dropped, NOW, random);
    assert.equal(drawn.length, 5);
    assert.ok(drawn.every((d) => pool.some((p) => p.item.id === d.item.id)));
    assert.ok(!drawn.some((d) => dropped.includes(d.item.id)));
    const again = practiceDraw(history, recipe, {}, dropped, NOW, () => 0.5);
    assert.notDeepEqual(drawn.map((d) => d.item.id), again.map((d) => d.item.id));
  });
});

describe("the cuts within a collection", () => {
  const history = sampleHistory(NOW);
  const cuts = Object.fromEntries(practiceCollections().map((c) => [c.id, c.cuts?.map((x) => x.id) ?? null]));

  it("names cuts only where the Library's sections are real categories", () => {
    assert.deepEqual(cuts.kana, ["hiragana", "katakana", "plain", "dakuten", "yoon"]);
    assert.deepEqual(cuts.counting, ["counters-constructions", "counters-tsu", "counters-numbers"]);
    assert.deepEqual(cuts.keigo, ["keigo-phrases", "keigo-verbs"]);
    assert.ok(cuts.grammar?.includes("form-te"));
    for (const id of ["kanji", "words", "radicals", "sentences", "verb-pairs"]) assert.equal(cuts[id], null, id);
  });

  it("combines a script with a row type, and widens within a group", () => {
    const at = (kept: readonly string[]) => practicePreview(history, { ...EMPTY_RECIPE, collections: ["kana"], cuts: { kana: kept }, size: "all" }, {}, NOW);
    const glyphs = (kept: readonly string[]) => at(kept).items.map((p) => p.item.glyph);
    const katakanaYoon = glyphs(["katakana", "yoon"]);
    assert.ok(katakanaYoon.length > 0 && katakanaYoon.every((g) => /^[ァ-ヺ]+$/.test(g) && g.length === 2), katakanaYoon.join(""));
    assert.ok(glyphs(["hiragana", "katakana"]).length > katakanaYoon.length);
    assert.equal(at([]).matched, at(["hiragana", "katakana"]).matched);
  });

  it("holds the counting rules and the numbers on the counting shelf, asked as readings", () => {
    const rules = practicePreview(history, { ...EMPTY_RECIPE, collections: ["counting"], cuts: { counting: ["counters-constructions"] }, size: "all" }, {}, NOW);
    assert.ok(rules.matched > 0);
    assert.ok(rules.items.every((p) => p.facts.every((f) => askOf(f as never) === "reading")));
    const whole = practicePreview(history, { ...EMPTY_RECIPE, collections: ["counting"], size: "all" }, {}, NOW);
    assert.ok(whole.matched > rules.matched + 10);
  });
});

// Run:
//   node --import ./src/lib/conjugate/test-hooks.mjs --test src/data/grammar/sentence-word-meanings.test.ts
//
// The meanings written for the pattern pages' sentences' words (SAK-508).
// Every row is a sentence a page shows and every word in it is one of that
// sentence's words, so a re-ingest that shows a different sentence fails here
// until the new one is read.

import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { sentenceExampleFor } from "./auto-page";
import { examplesFor } from "./corpus";
import { RECIPES } from "./recipes";
import { SENTENCE_WORD_MEANINGS } from "./sentence-word-meanings";

/** Each pattern page's sentence, by its corpus id. */
const shown = new Map(
  RECIPES.flatMap((r) => {
    const ex = sentenceExampleFor(r);
    if (!ex) return [];
    const source = examplesFor(r.id).find((e) => e.jp === ex.jp && e.en === ex.en)!;
    return [[String(source.id), ex] as const];
  }),
);

const rows = Object.entries(SENTENCE_WORD_MEANINGS).flatMap(([id, words]) => Object.entries(words).map(([lemma, row]) => ({ id, lemma, ...row })));

describe("the meanings written for the pattern pages' sentences' words", () => {
  test("every row is a sentence a page shows", () => {
    assert.deepEqual(Object.keys(SENTENCE_WORD_MEANINGS).filter((id) => !shown.has(id)), []);
  });

  test("every word is one of its sentence's words", () => {
    const stray = rows.filter((r) => !shown.get(r.id)?.words?.includes(r.lemma));
    assert.deepEqual(stray.map((r) => `${r.id} ${r.lemma}`), []);
  });

  test("the page gets the row", () => {
    for (const r of rows) assert.deepEqual(shown.get(r.id)?.wordMeanings?.[r.lemma], { ...(r.reading ? { reading: r.reading } : {}), meaning: r.meaning }, `${r.id} ${r.lemma}`);
  });

  test("a meaning is a few plain words", () => {
    for (const r of rows) {
      assert.ok(r.meaning.trim() === r.meaning && r.meaning, `${r.id} ${r.lemma}: "${r.meaning}"`);
      assert.ok(r.meaning.split(" ").length <= 4, `${r.id} ${r.lemma}: "${r.meaning}" is long`);
      assert.ok(!/[;()—–-]/.test(r.meaning), `${r.id} ${r.lemma}: "${r.meaning}" has a mark it should not`);
    }
  });

  test("a word with kanji has its reading in hiragana, and a kana word has none", () => {
    for (const r of rows) {
      if (/[㐀-鿿々]/.test(r.lemma)) assert.match(r.reading ?? "", /^[ぁ-ゟ]+$/, `${r.id} ${r.lemma}`);
      else assert.equal(r.reading, undefined, `${r.id} ${r.lemma}`);
    }
  });

  test("〜すぎる's sentence says 事 is a thing", () => {
    assert.deepEqual(SENTENCE_WORD_MEANINGS["5077"]?.["事"], { reading: "こと", meaning: "thing" });
  });
});

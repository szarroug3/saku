// Run:
//   node --import ./src/lib/conjugate/test-hooks.mjs --test src/data/grammar/sentence-english-marks.test.ts
//
// The English marks on the pattern pages' sentences (SAK-498). Every sentence
// a pattern page shows has been read and has a row, and every row's phrase is
// in its English once. A re-ingest that shows a different sentence fails here
// until the new one is read.

import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { sentenceExampleFor } from "./auto-page";
import { examplesFor } from "./corpus";
import { RECIPES } from "./recipes";
import { SENTENCE_ENGLISH_MARKS } from "./sentence-english-marks";

/** Each pattern page's sentence, with the key its row is under. */
const shown = RECIPES.flatMap((r) => {
  const ex = sentenceExampleFor(r);
  if (!ex) return [];
  const source = examplesFor(r.id).find((e) => e.jp === ex.jp && e.en === ex.en)!;
  return [{ recipe: r.id, key: `${source.id}:${r.id}`, ex }];
});

describe("the English marks on the pattern pages' sentences", () => {
  test("91 pattern pages show a sentence", () => {
    assert.equal(shown.length, 91);
  });

  test("every shown sentence has a row", () => {
    const missing = shown.filter((s) => !Object.hasOwn(SENTENCE_ENGLISH_MARKS, s.key));
    assert.deepEqual(missing.map((s) => `${s.key} ${s.ex.jp} ${s.ex.en}`), []);
  });

  test("every row is a sentence a page shows", () => {
    const keys = new Set(shown.map((s) => s.key));
    assert.deepEqual(Object.keys(SENTENCE_ENGLISH_MARKS).filter((k) => !keys.has(k)), []);
  });

  test("every phrase is in its English exactly once", () => {
    for (const { key, ex } of shown) {
      const phrase = SENTENCE_ENGLISH_MARKS[key];
      if (phrase === null || phrase === undefined) continue;
      assert.ok(phrase.trim() === phrase && phrase, `${key}: "${phrase}" is empty or has spaces at its ends`);
      assert.equal(ex.en.split(phrase).length - 1, 1, `${key}: "${phrase}" is not in "${ex.en}" exactly once`);
    }
  });

  test("no phrase starts or ends partway through a word", () => {
    const WORD = /[A-Za-z0-9]/;
    for (const { key, ex } of shown) {
      const phrase = SENTENCE_ENGLISH_MARKS[key];
      if (!phrase) continue;
      const at = ex.en.indexOf(phrase);
      assert.ok(!WORD.test(ex.en[at - 1] ?? "") && !WORD.test(ex.en[at + phrase.length] ?? ""), `${key}: "${phrase}" starts or ends inside a word of "${ex.en}"`);
    }
  });

  test("the page gets the phrase's place in the English", () => {
    for (const { key, ex } of shown) {
      const phrase = SENTENCE_ENGLISH_MARKS[key];
      if (phrase === null) assert.equal(ex.enSpan, null, key);
      else {
        assert.ok(ex.enSpan, key);
        assert.equal(ex.en.slice(ex.enSpan[0], ex.enSpan[1]), phrase, key);
      }
    }
  });

  test("を's sentence marks nap", () => {
    const wo = shown.find((s) => s.recipe === "wo")!;
    assert.equal(wo.key, "4727:wo");
    assert.equal(wo.ex.en.slice(...(wo.ex.enSpan as [number, number])), "nap");
  });
});

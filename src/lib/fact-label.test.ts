// Run: node --import ./src/lib/conjugate/test-hooks.mjs --test \
//        src/lib/fact-label.test.ts
//
// THE BUG, IN ONE GLYPH
// =====================
// On "Pick what to retry" every chip was its glyph and nothing else, so 何 could
// sit in the list three times — the kanji's meaning, the kanji's reading, and
// the word's meaning — as three identical 何 the learner could not tell apart.
// The label is the second line that says which is which, and the one thing it
// must never do is hand back the answer.

import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { meaningFactId, readingFactId } from "@/data/kanji";
import { radicalMeaningFactId } from "@/data/radicals";
import { wordMeaningFactId, wordReadingFactId } from "@/data/vocab";
import { ALL_FACTS } from "@/lib/facts";
import { factTypeLabel } from "@/lib/fact-label";

describe("factTypeLabel — telling one glyph's facts apart", () => {
  test("the three 何 facts get three distinct labels", () => {
    // The headline case. Same glyph, three different questions.
    const kanjiMeaning = factTypeLabel(meaningFactId("何"));
    const kanjiReading = factTypeLabel(readingFactId("何", "何"));
    const wordMeaning = factTypeLabel(wordMeaningFactId("何"));

    assert.equal(kanjiMeaning, "kanji · meaning");
    assert.equal(kanjiReading, "kanji · reading");
    assert.equal(wordMeaning, "word · meaning");
    assert.equal(
      new Set([kanjiMeaning, kanjiReading, wordMeaning]).size,
      3,
      "all three must differ",
    );
  });

  test("a word's own reading and meaning also split", () => {
    assert.equal(factTypeLabel(wordReadingFactId("何")), "word · reading");
    assert.equal(factTypeLabel(wordMeaningFactId("何")), "word · meaning");
  });

  test("a single-aspect subject is just its noun, no suffix", () => {
    // Kana and a radical have one askable fact per glyph, so a "· meaning"
    // suffix would be noise — and kana has no meaning to name at all.
    const kana = ALL_FACTS.find((f) => String(f).startsWith("kana:あ"));
    assert.ok(kana, "あ is a fact");
    assert.equal(factTypeLabel(kana), "kana");
    // A radical is named by the same word the drill uses: "shape", not "radical".
    assert.equal(factTypeLabel(radicalMeaningFactId("一")), "shape");
  });

  test("the label is never the answer", () => {
    // A chip is about to be re-asked; its label must not leak the reading or
    // the gloss. It names the KIND of question, nothing the box would accept.
    for (const f of [
      meaningFactId("何"),
      readingFactId("何", "何"),
      wordMeaningFactId("何"),
      wordReadingFactId("何"),
    ]) {
      const label = factTypeLabel(f);
      assert.ok(!/なに|か|what/i.test(label), `${f} → "${label}" leaks an answer`);
    }
  });
});

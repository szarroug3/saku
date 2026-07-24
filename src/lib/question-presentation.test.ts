// Run: node --import ./src/lib/conjugate/test-hooks.mjs --test \
//        src/lib/question-presentation.test.ts
//
// The chip that says HOW a card was asked. Sam's ask, verbatim: "hear the word
// and type the meaning, hear the word and type the japanese, see the meaning in
// english and type the word in japanese". The label is `noun · input → output`,
// and the two things it must never do are disagree with the drill about what was
// being asked, and leak the answer.

import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { meaningFactId, readingFactId } from "@/data/kanji";
import { wordMeaningFactId, wordReadingFactId } from "@/data/vocab";
import { factTypeLabel } from "@/lib/fact-label";
import { presentationLabel } from "@/lib/question-presentation";
import type { ShowingPresentation } from "@/types";

const show = (
  dir: "en2jp" | "jp2en",
  mode: "mc" | "typed",
  listen: boolean,
): ShowingPresentation => ({ dir, mode, listen });

describe("presentationLabel — how the card was asked", () => {
  test("Sam's three examples read the way she wrote them", () => {
    // hear the word and type the meaning
    assert.equal(
      presentationLabel(wordMeaningFactId("問題"), show("jp2en", "typed", true)),
      "word · hear it → type the meaning",
    );
    // hear the word and type the japanese (its reading)
    assert.equal(
      presentationLabel(wordReadingFactId("問題"), show("jp2en", "typed", true)),
      "word · hear it → type the reading",
    );
    // see the meaning in english and type the word in japanese
    assert.equal(
      presentationLabel(wordMeaningFactId("問題"), show("en2jp", "typed", false)),
      "word · see the meaning → type the Japanese",
    );
  });

  test("a listening meaning card reads 'hear it → type the meaning'", () => {
    assert.equal(
      presentationLabel(wordMeaningFactId("何"), show("jp2en", "typed", true)),
      "word · hear it → type the meaning",
    );
  });

  test("the noun is kept, so kanji and word asked identically still differ", () => {
    // The whole reason the type stays in: 可 the kanji means "can", 可 the word
    // "acceptable". Same presentation, two facts — the labels must not collide.
    const p = show("jp2en", "typed", false);
    const kanji = presentationLabel(meaningFactId("何"), p);
    const word = presentationLabel(wordMeaningFactId("何"), p);
    assert.equal(kanji, "kanji · see it → type the meaning");
    assert.equal(word, "word · see it → type the meaning");
    assert.notEqual(kanji, word);
  });

  test("MC swaps 'type' for 'pick'", () => {
    assert.equal(
      presentationLabel(meaningFactId("何"), show("jp2en", "mc", false)),
      "kanji · see it → pick the meaning",
    );
  });

  test("the SAME fact asked two ways gets two labels — the per-showing rule", () => {
    // The chip is one-per-fact and labels the LAST showing's presentation. The
    // label function is a pure function of (fact, presentation), so a fact heard
    // and a fact seen read differently — which is exactly what lets a re-ask
    // overwrite the badge without the screens knowing anything changed.
    const fact = wordMeaningFactId("何");
    const heard = presentationLabel(fact, show("jp2en", "typed", true));
    const seen = presentationLabel(fact, show("jp2en", "typed", false));
    assert.equal(heard, "word · hear it → type the meaning");
    assert.equal(seen, "word · see it → type the meaning");
    assert.notEqual(heard, seen);
  });

  test("no presentation → falls back to the fact's type badge", () => {
    // A skipped card, an old snapshot, a summarised stored session: no showing
    // was recorded, so name what the fact IS instead.
    const fact = meaningFactId("何");
    assert.equal(presentationLabel(fact, undefined), factTypeLabel(fact));
    assert.equal(presentationLabel(fact, undefined), "kanji · meaning");
  });

  test("the label never leaks the answer", () => {
    const cases: Array<[ReturnType<typeof meaningFactId>, ShowingPresentation]> = [
      [meaningFactId("何"), show("jp2en", "typed", false)],
      [readingFactId("何", "何"), show("jp2en", "typed", true)],
      [wordMeaningFactId("何"), show("en2jp", "mc", false)],
      [wordReadingFactId("何"), show("jp2en", "typed", true)],
    ];
    for (const [fact, p] of cases) {
      const label = presentationLabel(fact, p);
      assert.ok(!/なに|か|what/i.test(label), `${fact} → "${label}" leaks an answer`);
    }
  });
});

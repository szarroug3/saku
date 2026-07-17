// Run: node --import ./src/lib/conjugate/test-hooks.mjs --test src/lib/fact-speech.test.ts
//
// The "has a sound" line the teach 🔊 draws, pinned as claims. The rule is not
// cosmetic: a speaker on a bare kanji or a grammar pattern would read out
// garbage (nine readings, or a shape that has no pronunciation), so these fix
// exactly which subjects get a button and WHICH text it speaks — the kanji
// reading case in particular must speak the anchor WORD, not the kanji.

import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { KANA_SUBJECT } from "@/data/characters";
import { GRAMMAR_SUBJECT } from "@/data/grammar";
import { KANJI_SUBJECT } from "@/data/kanji";
import { VOCAB_SUBJECT } from "@/data/vocab";
import type { EntryId, FactId, FactInfo } from "@/types";

import { speechForFact } from "./fact-speech.ts";

/** A minimal FactInfo — speechForFact reads only `subject` and `glyph`. */
function fact(subject: string, glyph: string): FactInfo {
  return {
    id: "x" as FactId,
    entry: "x" as EntryId,
    glyph,
    answers: ["-"],
    subject,
    meaning: null,
  };
}

describe("speechForFact — which teach cards get a 🔊, and what it says", () => {
  test("kana speaks its own glyph", () => {
    assert.equal(speechForFact(fact(KANA_SUBJECT, "あ")), "あ");
  });

  test("a word speaks its own glyph", () => {
    assert.equal(speechForFact(fact(VOCAB_SUBJECT, "先生"), "先生"), "先生");
    // The anchor is a kanji-only hint; a word ignores it and speaks its glyph.
    assert.equal(speechForFact(fact(VOCAB_SUBJECT, "先生")), "先生");
  });

  test("a kanji READING fact speaks the anchor word, not the kanji", () => {
    // The teach screen passes anchorForFact() — the known word framing the card.
    assert.equal(speechForFact(fact(KANJI_SUBJECT, "生"), "先生"), "先生");
  });

  test("a kanji MEANING fact (no anchor) has no sound", () => {
    assert.equal(speechForFact(fact(KANJI_SUBJECT, "生")), null);
  });

  test("a grammar pattern has no sound", () => {
    assert.equal(speechForFact(fact(GRAMMAR_SUBJECT, "〜てから"), "〜てから"), null);
  });

  test("an unknown subject errs toward silence", () => {
    assert.equal(speechForFact(fact("counter", "本"), "本"), null);
  });
});

// Run: node --import ./src/lib/conjugate/test-hooks.mjs --test src/lib/fact-speech.test.ts
//
// The "has a sound" line the teach 🔊 draws, pinned as claims. The rule is not
// cosmetic: a speaker on a bare kanji or a grammar pattern would read out
// garbage (nine readings, or a shape that has no pronunciation), so these fix
// exactly which subjects get a button and WHICH text it speaks — a word and a
// kanji reading both speak a kana READING, never a bare glyph a phone's TTS is
// free to voice with the wrong on'yomi (何 → か instead of the taught なに).

import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { KANA_SUBJECT } from "@/data/characters";
import { GRAMMAR_SUBJECT } from "@/data/grammar";
import { KANJI_SUBJECT } from "@/data/kanji";
import { VOCAB_SUBJECT, wordMeaningFactId } from "@/data/vocab";
import { factInfo } from "@/lib/facts";
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

  test("a word speaks its READING, not the written glyph", () => {
    // せんせい reads the same whether the TTS is handed 先生 or the kana, so the
    // change is invisible here — but the anchor is a kanji-only hint a word
    // ignores, and the reading is what the card taught either way.
    assert.equal(speechForFact(fact(VOCAB_SUBJECT, "先生"), "先生"), "せんせい");
    assert.equal(speechForFact(fact(VOCAB_SUBJECT, "先生")), "せんせい");
  });

  test("何 speaks the taught なに, never the on'yomi か the phone prefers", () => {
    // The headline bug: a listening card for word:何/meaning spoke the written
    // 何, and the phone's TTS was free to read it か. The reading pins なに.
    assert.equal(speechForFact(fact(VOCAB_SUBJECT, "何")), "なに");
    const info = factInfo(wordMeaningFactId("何"));
    assert.ok(info, "word:何/meaning is a real fact");
    assert.equal(speechForFact(info), "なに");
    assert.notEqual(speechForFact(info), "何");
  });

  test("a kanji READING fact speaks the anchor word's reading, not the kanji", () => {
    // The teach screen passes anchorForFact() — the known word framing the card.
    // せんせい, so 先's せい reading is heard where it lives; and when the anchor
    // is a single kanji its own written form would be TTS-ambiguous too.
    assert.equal(speechForFact(fact(KANJI_SUBJECT, "生"), "先生"), "せんせい");
    assert.equal(speechForFact(fact(KANJI_SUBJECT, "何"), "何"), "なに");
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

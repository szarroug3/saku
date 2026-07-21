// The two things the drill says beside the question: what the box wants, and
// what you mixed this up with.
//
//   node --import ./src/lib/conjugate/test-hooks.mjs --test src/lib/drill-guidance.test.ts

import test from "node:test";
import assert from "node:assert/strict";

import { answerGuide, confusionNote } from "@/lib/drill-guidance";
import { answerIsJapanese } from "@/lib/engine/question";
import { ALL_FACTS, entryOf, factInfo } from "@/lib/facts";
import { KANA_SUBJECT, kanaEntry, kanaFact } from "@/data/characters";
import type { Direction } from "@/types";

const DIRS: Direction[] = ["jp2en", "en2jp"];

// ---------- answerGuide ----------

// THE TEST THAT MATTERS. Only a card the box CONVERTS may be told its romaji
// turns into kana. Asserted over every fact in both directions rather than a
// sampled few, because the failure this guards is a new subject whose answers
// change script while the copy stays put — precisely the case a hand-picked
// sample would not contain.
test("only a converting card says its romaji turns into kana", () => {
  for (const f of ALL_FACTS) {
    for (const dir of DIRS) {
      assert.equal(
        /turns into kana/.test(answerGuide(f, dir).note),
        answerIsJapanese(f, dir),
        `${f} ${dir}: guide and answerIsJapanese disagree`,
      );
    }
  }
});

// The corollary, and the one the probe actually hit: no card may be told to
// answer in English unless English is what it wants. あ jp2en wants "a", which
// is romaji and is not English, and it is the first card a beginner ever sees.
test("no card is told to answer in English unless it wants English", () => {
  for (const f of ALL_FACTS) {
    for (const dir of DIRS) {
      const g = answerGuide(f, dir);
      if (!/Answer in English/.test(g.note)) continue;
      assert.equal(factInfo(f)?.subject === KANA_SUBJECT, false, `${f} ${dir}`);
      assert.equal(answerIsJapanese(f, dir), false, `${f} ${dir}`);
    }
  }
});

test("kana asked jp2en is told the answer is romaji, and not called English", () => {
  const g = answerGuide(kanaFact("お"), "jp2en");
  assert.match(g.placeholder, /romaji/);
  assert.match(g.note, /[Rr]omaji/);
  assert.doesNotMatch(g.note, /Answer in English/);
});

// Katakana is the half a "convert it and see if you get the glyph back" test
// silently loses: toKana produces hiragana, so ア would never match and every
// katakana card would be told to answer in English.
test("katakana gets the same romaji line as hiragana", () => {
  assert.deepEqual(
    answerGuide(kanaFact("ア"), "jp2en"),
    answerGuide(kanaFact("あ"), "jp2en"),
  );
});

// The other half of that trap, from the opposite side: おでん's English gloss
// is "oden", which converts straight back to おでん. It is a word MEANING and
// wants English.
test("a word whose gloss round-trips to its own kana still wants English", () => {
  const oden = ALL_FACTS.find((f) => String(f) === "word:おでん/meaning");
  assert.ok(oden, "expected word:おでん/meaning in the registry");
  assert.match(answerGuide(oden, "jp2en").note, /Answer in English/);
});

test("a kana asked en2jp is told it wants romaji", () => {
  const g = answerGuide(kanaFact("お"), "en2jp");
  assert.match(g.note, /kana as you type/);
});

test("every guide says something in both halves", () => {
  for (const f of ALL_FACTS.slice(0, 500)) {
    for (const dir of DIRS) {
      const g = answerGuide(f, dir);
      assert.ok(g.placeholder.length > 0 && g.note.length > 0, String(f));
    }
  }
});

// No em dashes anywhere in learner-facing copy — the owner's rule, and cheaper
// to assert than to re-read.
test("no em dashes in the copy", () => {
  const strings = [
    answerGuide(kanaFact("お"), "en2jp").placeholder,
    answerGuide(kanaFact("お"), "en2jp").note,
    answerGuide(kanaFact("お"), "jp2en").placeholder,
    answerGuide(kanaFact("お"), "jp2en").note,
    answerGuide("kanji:一/meaning" as (typeof ALL_FACTS)[number], "jp2en").note,
    confusionNote(kanaEntry("お"), kanaEntry("あ")) ?? "",
  ];
  for (const s of strings) assert.ok(!s.includes("—"), `em dash in "${s}"`);
});

// ---------- confusionNote ----------

test("names the あ / お mix-up, with the glyph that was answered", () => {
  const note = confusionNote(kanaEntry("お"), kanaEntry("あ"));
  assert.ok(note, "あ/お is in LOOKALIKES and must be named");
  assert.match(note, /あ/);
  assert.doesNotMatch(note, /undefined/);
});

test("it is symmetric — either glyph on screen names the pair", () => {
  assert.ok(confusionNote(kanaEntry("あ"), kanaEntry("お")));
});

// SILENCE IS THE DEFAULT. `confusedWith` resolves whatever single entry in the
// deck answers to what was typed, which is not the same as the app having ever
// predicted that pair. Claiming "these get mixed up a lot" off one keystroke
// would put a line on screen that the mix-ups card does not agree with.
test("says nothing about a pair the app does not predict", () => {
  assert.equal(confusionNote(kanaEntry("お"), kanaEntry("ら")), null);
});

test("says nothing about an entry confused with itself", () => {
  assert.equal(confusionNote(kanaEntry("お"), kanaEntry("お")), null);
});

test("says nothing for an entry id that resolves to no entry", () => {
  const bogus = entryOf(ALL_FACTS[0]);
  assert.equal(confusionNote(`${bogus}zzz` as typeof bogus, bogus), null);
});

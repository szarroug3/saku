// The drill's hint: what each kind of card says, what it costs, and the cards
// that get no button at all.
//
//   node --import ./src/lib/conjugate/test-hooks.mjs --test src/lib/engine/hint.test.ts
//
// The two halves of the feature are tested apart because they are apart in the
// code: `hintFor` decides WHAT a hint says (and whether there is one), and
// `firstTryCredit` decides what taking it COSTS. Neither knows about the other.

import test from "node:test";
import assert from "node:assert/strict";

import { kanaFact } from "@/data/characters";
import { patternMeaningFactId, patternProductionFactId } from "@/data/grammar";
import { meaningFactId, readingFactId } from "@/data/kanji";
import { wordMeaningFactId, wordReadingFactId } from "@/data/vocab";
import { firstTryCredit } from "@/lib/engine/index";
import { hintFor } from "@/lib/engine/hint";

/** The text of a text hint, or a failure that says what came back instead. */
function textOf(hint: ReturnType<typeof hintFor>, what: string): string {
  assert.ok(hint, `expected a hint for ${what}, got none`);
  assert.equal(hint.kind, "text", `expected a text hint for ${what}`);
  return hint.kind === "text" ? hint.text : "";
}

// ---------- what each type says ----------

test("a kana asked for its romaji hints with the drawn picture, and nothing else", () => {
  const hint = hintFor(kanaFact("あ"), "jp2en");
  assert.ok(hint, "あ has a drawing, so it has a hint");
  assert.equal(hint.kind, "image");
  // The picture, by the path getMnemonic derives — split by script so か and カ
  // don't collide. No story text and no example word ride along: the mnemonic's
  // TEXT names the answer, which is why the hint is the picture alone.
  assert.equal(hint.kind === "image" && hint.src, "/mnemonics/hiragana/a.webp");
  assert.equal(hint.kind === "image" && hint.glyph, "あ");
});

test("a kanji reading hints with what the word's OTHER kanji reads", () => {
  // The case the whole feature was described by: 生 in 人生 → ?
  assert.equal(
    textOf(hintFor(readingFactId("生", "人生"), "jp2en"), "生 in 人生"),
    "人 is じん here",
  );
});

test("a kanji meaning hints with its teachable components", () => {
  // KanjiVG depth-1 order: 日 (left) then 月 (right), the reading order — not the
  // old KRADFILE 月+日. Both are taught, so both name their meaning.
  assert.equal(
    textOf(hintFor(meaningFactId("明"), "jp2en"), "明's meaning"),
    "made of 日 (day) + 月 (month)",
  );
});

test("a word asked for its meaning hints with its kanji's meanings", () => {
  assert.equal(
    textOf(hintFor(wordMeaningFactId("先生"), "jp2en"), "先生's meaning"),
    "先 is before, 生 is life",
  );
});

test("a word asked for its reading hints with the first kanji's reading here", () => {
  assert.equal(
    textOf(hintFor(wordReadingFactId("先生"), "jp2en"), "先生's reading"),
    "先 is せん here",
  );
});

test("a grammar meaning hints with what the pattern attaches to", () => {
  assert.equal(
    textOf(hintFor(patternMeaningFactId("te-kara"), "jp2en"), "〜てから's meaning"),
    "attaches to a verb",
  );
});

test("a grammar production hints with the form it builds on", () => {
  // Never the built answer: knowing 〜てから takes the て-form does not tell you
  // 行ってから.
  const text = textOf(
    hintFor(patternProductionFactId("te-kara"), "jp2en"),
    "〜てから's production",
  );
  assert.equal(text, "uses the て-form");
  assert.ok(!text.includes("行"), "the hint must not contain the built form");
});

// ---------- the cards with no hint ----------

test("a katakana glyph has no drawing, so it has no hint", () => {
  // No katakana is drawn today. The candidate path exists (getMnemonic derives
  // one for every kana) but the drill probes it and hides the button; here the
  // builder still offers the candidate, so the guard being tested is that ア is
  // NOT silently given hiragana's file.
  const hint = hintFor(kanaFact("ア"), "jp2en");
  if (hint) {
    assert.equal(hint.kind, "image");
    assert.equal(hint.kind === "image" && hint.src, "/mnemonics/katakana/a.webp");
  }
});

test("an all-kana word has nothing to take apart, so it has no hint", () => {
  assert.equal(hintFor(wordMeaningFactId("これ"), "jp2en"), null);
});

test("a jukujikun word has no per-kanji reading to name", () => {
  // 大人 is おとな: the reading belongs to the word, not to 大 and 人. `align` is
  // null for exactly these, and the hint declines rather than inventing a split.
  assert.equal(hintFor(wordReadingFactId("大人"), "jp2en"), null);
});

test("a kanji whose components aren't all teachable gets no parts hint", () => {
  // 生's KRADFILE decomposition includes primitives with no jōyō card, which is
  // the same all-or-nothing test the lesson's "Built from parts" line applies —
  // raw KRADFILE primitives are never shown.
  assert.equal(hintFor(meaningFactId("生"), "jp2en"), null);
});

// ---------- the answer is never in the hint ----------

test("meaning-side hints are refused in the direction where they'd be the answer", () => {
  // Shown "bright" and asked for the glyph, 明's components hand over the answer.
  assert.equal(hintFor(meaningFactId("明"), "en2jp"), null);
  // Shown "teacher" and asked for 先生, naming 先 and 生 IS 先生.
  assert.equal(hintFor(wordMeaningFactId("先生"), "en2jp"), null);
  // Shown "teacher" and asked for せんせい, naming 先's せん is half of it.
  assert.equal(hintFor(wordReadingFactId("先生"), "en2jp"), null);
  // Shown "a" and asked for あ, a drawing OF あ is the answer.
  assert.equal(hintFor(kanaFact("あ"), "en2jp"), null);
});

test("hints that name something OTHER than the asked item are offered both ways", () => {
  // A sibling kanji's reading is not 生's reading, and a pattern's host is not
  // its gloss — neither can be the answer whichever way the card is turned.
  assert.equal(
    textOf(hintFor(readingFactId("生", "人生"), "en2jp"), "生 in 人生, en2jp"),
    "人 is じん here",
  );
  assert.equal(
    textOf(hintFor(patternMeaningFactId("te-kara"), "en2jp"), "〜てから, en2jp"),
    "attaches to a verb",
  );
});

test("a kanji reading is hinted on the word the SHOWING framed it on", () => {
  // word-unlock may move the question onto a word the learner has actually met.
  // Hinting the fact's own anchor would name kanji that are not on screen.
  const onOwnAnchor = hintFor(readingFactId("生", "人生"), "jp2en");
  const onAnother = hintFor(readingFactId("生", "人生"), "jp2en", {
    anchor: "学生",
  });
  assert.equal(textOf(onOwnAnchor, "生 in 人生"), "人 is じん here");
  assert.equal(textOf(onAnother, "生 in 学生"), "学 is がく here");
});

// ---------- what a hint costs ----------

test("a hinted-correct answer is correct but not first-try", () => {
  // The third outcome. Right, clean (no wrong attempt), hinted → no credit.
  assert.equal(firstTryCredit(true, 0, true), false);
});

test("an unhinted clean answer still earns the credit", () => {
  assert.equal(firstTryCredit(true, 0, false), true);
});

test("a hint cannot rescue an answer that was already going to miss the credit", () => {
  assert.equal(firstTryCredit(true, 1, false), false);
  assert.equal(firstTryCredit(true, 1, true), false);
  assert.equal(firstTryCredit(false, 0, false), false);
  assert.equal(firstTryCredit(false, 0, true), false);
});

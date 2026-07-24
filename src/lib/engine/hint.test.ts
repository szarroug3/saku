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

test("a kanji meaning hints with its teachable components, never the gloss", () => {
  // KanjiVG depth-1 order: 日 (left) then 月 (right), the reading order — not the
  // old KRADFILE 月+日. Both are taught, so both name their meaning. ≥2 parts, so
  // the learner still has to assemble "bright" from day + month.
  const text = textOf(hintFor(meaningFactId("明"), "jp2en"), "明's meaning");
  assert.equal(text, "made of 日 (day) + 月 (month)");
  assert.ok(!text.includes("bright"), "the component hint must not state the gloss");
});

test("a word asked for its meaning hints with its kanji's meanings", () => {
  assert.equal(
    textOf(hintFor(wordMeaningFactId("先生"), "jp2en"), "先生's meaning"),
    "先 is before, 生 is life",
  );
});

test("電話 (a 2-kanji word) meaning hints with its components, not the gloss", () => {
  // Task 24: this hint was generated all along — the drill was hiding the button
  // on a LISTENING meaning card. hintFor itself is unconditional: 電話 is a
  // multi-kanji word, so its meaning card names 電 and 話, and the English answer
  // ("phone call") never appears in the nudge.
  const text = textOf(hintFor(wordMeaningFactId("電話"), "jp2en"), "電話's meaning");
  assert.equal(text, "電 is electricity, 話 is tale");
  assert.ok(!/phone|call/i.test(text), "the component hint must not state the gloss");
  // ...and never en2jp, where naming the kanji IS how you write the answer.
  assert.equal(hintFor(wordMeaningFactId("電話"), "en2jp"), null);
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

test("a single-kanji word asked its MEANING has no hint — the gloss is the answer", () => {
  // 口 is one kanji, so its per-kanji breakdown ("口 is mouth") is the whole
  // gloss the card is asking for, not a nudge toward it. No decomposition, no
  // hint. Regression: this used to print "口 is mouth" under the prompt on a
  // hinted retry, handing over the answer.
  const hint = hintFor(wordMeaningFactId("口"), "jp2en");
  const text = hint?.kind === "text" ? hint.text : "";
  assert.ok(!text.includes("mouth"), "the meaning hint must never be the gloss");
  assert.equal(hint, null, "and the honest thing to say is nothing at all");
});

test("a single-kanji word asked its READING has no hint — the reading is the answer", () => {
  // 人's only kanji reads ひと here, and ひと is the whole reading the card wants,
  // not a first half of it. "人 is ひと here" was the answer with extra words.
  const hint = hintFor(wordReadingFactId("人"), "jp2en");
  const text = hint?.kind === "text" ? hint.text : "";
  assert.ok(!text.includes("ひと"), "the reading hint must never be the reading");
  assert.equal(hint, null, "and the honest thing to say is nothing at all");
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

test("an atomic/pictograph kanji meaning has no hint — one part IS the answer", () => {
  // 人 and 口 do not decompose into ≥2 taught kanji, so there is nothing to
  // assemble. A single-component "made of X" hint would just be the gloss with
  // one extra word, so the meaning card declines. This is the kanji-side twin of
  // the single-kanji WORD rule below.
  assert.equal(hintFor(meaningFactId("人"), "jp2en"), null);
  assert.equal(hintFor(meaningFactId("口"), "jp2en"), null);
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

test("a grammar hint that names neither gloss nor output is offered both ways", () => {
  // A pattern's host is not its gloss, so it can be shown whichever way the card
  // is turned. (Reading and meaning hints, by contrast, are one-direction — see
  // the reading section and the meaning-side test above.)
  assert.equal(
    textOf(hintFor(patternMeaningFactId("te-kara"), "en2jp"), "〜てから, en2jp"),
    "attaches to a verb",
  );
});

// ---------- no reading card gets a hint ----------

test("a kanji reading fact has no hint — the reading is the answer", () => {
  // Was "先 is せん here": naming the word's other kanji decomposes the very
  // reading the card asked for. Both directions, and framed on any word.
  assert.equal(hintFor(readingFactId("生", "先生"), "jp2en"), null);
  assert.equal(hintFor(readingFactId("生", "先生"), "en2jp"), null);
});

test("a two-kanji word reading fact has no hint — half the reading is still a giveaway", () => {
  // 家族 asked for its reading used to hint "家 is か here", handing over half of
  // かぞく. Decomposing a reading is a giveaway by design, so there is no hint.
  const hint = hintFor(wordReadingFactId("家族"), "jp2en");
  const text = hint?.kind === "text" ? hint.text : "";
  assert.ok(!text.includes("か"), "the reading hint must not name any of the reading");
  assert.equal(hint, null);
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

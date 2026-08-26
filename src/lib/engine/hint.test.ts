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
import {
  classProductionFactId,
  patternMeaningFactId,
  patternProductionFactId,
  specialVerbProductionFactId,
} from "@/data/grammar";
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

test("a LISTENING meaning card for 電話 hints with the written form AND its parts", () => {
  // Task 25: the audio played 電話 and the glyph is hidden, so the nudge shows the
  // WRITTEN WORD itself — see which word you heard — and, because 電話 is TWO
  // kanji, the per-kanji meanings beneath it. jp2en, because listening forces it.
  const hint = hintFor(wordMeaningFactId("電話"), "jp2en", undefined, true);
  assert.ok(hint, "a listening meaning card has a hint");
  assert.equal(hint.kind, "written", "and it is the written form, rendered big");
  const text = hint.kind === "written" ? hint.text : "";
  const parts = hint.kind === "written" ? (hint.parts ?? "") : "";
  assert.equal(text, "電話", "the written word the learner just heard");
  assert.equal(parts, "電 is electricity, 話 is tale", "plus the component meanings");
  // Never the English answer — neither the word nor its breakdown states the gloss.
  assert.ok(
    !/phone|call|telephone/i.test(text + " " + parts),
    "the listening hint must never state the English gloss",
  );
});

test("a NON-listening meaning card for 電話 is unchanged — components only, as text", () => {
  // The visual meaning card already shows 電話 on screen, so its hint stays the
  // component breakdown alone — a plain text hint, no written form.
  const hint = hintFor(wordMeaningFactId("電話"), "jp2en");
  assert.equal(hint?.kind, "text");
  assert.equal(textOf(hint, "電話 visual"), "電 is electricity, 話 is tale");
  // Passing listen=false explicitly is the same as the default.
  assert.equal(
    textOf(hintFor(wordMeaningFactId("電話"), "jp2en", undefined, false), "電話 listen=false"),
    "電 is electricity, 話 is tale",
  );
});

test("a listening single-kanji / all-kana word is written-form ONLY, no breakdown", () => {
  // A single-kanji word (口) and an all-kana word (これ) have nothing to break
  // down, so the listening hint is the bare written form with no `parts`.
  const kuchi = hintFor(wordMeaningFactId("口"), "jp2en", undefined, true);
  assert.equal(kuchi?.kind, "written");
  assert.equal(kuchi?.kind === "written" && kuchi.text, "口");
  assert.equal(
    kuchi?.kind === "written" && kuchi.parts,
    undefined,
    "one kanji has nothing to break down",
  );
  assert.ok(
    !(kuchi?.kind === "written" && /mouth/i.test(kuchi.text)),
    "the written form is the word, not its meaning",
  );
  const kore = hintFor(wordMeaningFactId("これ"), "jp2en", undefined, true);
  assert.equal(kore?.kind, "written");
  assert.equal(kore?.kind === "written" && kore.text, "これ");
  assert.equal(
    kore?.kind === "written" && kore.parts,
    undefined,
    "an all-kana word has no kanji to break down",
  );
});

test("a listening READING card still gets no hint — the reading is the answer", () => {
  // `listen` only rescues the MEANING card. A reading fact declines outright,
  // exactly as a visual reading card does, so hearing 電話 and typing でんわ is
  // never handed the reading.
  assert.equal(hintFor(wordReadingFactId("電話"), "jp2en", undefined, true), null);
});

test("a grammar meaning hints with what the pattern attaches to", () => {
  assert.equal(
    textOf(hintFor(patternMeaningFactId("te-kara"), "jp2en"), "〜てから's meaning"),
    "attaches to a verb",
  );
});

test("a grammar production hints with the pattern name and the form it builds on", () => {
  // Never the built answer: knowing 〜てから takes the て-form does not tell you
  // 買ってから. te-kara's production is per-ending now, so this asks its te-utsu
  // fact — the hint is the same "uses the て-form" for every ending, now led by
  // the pattern name (SAK-193): the quiz instruction asks in gloss terms
  // ("How do you say 'after 買う'?") and no longer names the pattern itself.
  const text = textOf(
    hintFor(classProductionFactId("te-kara", "v5u"), "jp2en"),
    "〜てから's production",
  );
  assert.equal(text, "This is the 〜てから pattern. uses the て-form");
  assert.ok(!text.includes("買"), "the hint must not contain the built form");
});

test("a FORM recipe's production still hints with its pattern name, but no form nudge", () => {
  // te-sequence IS the て-form. On a card asking the learner to BUILD the
  // て-form, "uses the て-form" is the prompt restated, not a nudge — the same
  // tautology the dictionary-form guard refuses, so formHintText stays silent.
  // But the pattern-name line (SAK-193) is not a tautology — it survives, so a
  // FORM recipe's production is no longer the one production card with no hint
  // at all. The te-form IRREGULARS are the same skill (produce 行って), so they
  // get the same bare pattern-name hint.
  assert.deepEqual(
    hintFor(classProductionFactId("te-sequence", "v5u"), "jp2en"),
    { kind: "text", text: "This is the 〜て pattern" },
  );
  assert.deepEqual(
    hintFor(specialVerbProductionFactId("te-sequence", "iku"), "jp2en"),
    { kind: "text", text: "This is the 〜て pattern" },
  );
});

// SAK-194: given a VEHICLE, a production hint now tries the structured
// two-step derivation FIRST (see deriveProduction / grammarHint), and it
// replaces the flat "pattern + form + class" sentence entirely when it
// succeeds — which is every ordinary verb/adjective card. The old
// known/unknown class-nudge tests below are rewritten to check the
// derivation's own fields instead of a sentence that no longer renders once
// a vehicle is on hand; the flat-text class nudge itself is now reachable
// only when deriveProduction declines (see the wrap test further down).

test("a KNOWN る-verb's production derives the two-step equation, not the flat sentence", () => {
  // 食べる (v1) -> 食べ (stem, − る) -> 食べたい (+ たい).
  const KNOWN = { surface: "食べる", kana: "たべる", cls: "v1", known: true } as const;
  const hint = hintFor(classProductionFactId("tai", "v1"), "en2jp", undefined, false, KNOWN);
  assert.ok(hint, "expected a hint for tai + known 食べる");
  assert.equal(hint.kind, "derivation");
  assert.ok(hint.kind === "derivation");
  assert.equal(hint.derivation.word, "食べる");
  assert.equal(hint.derivation.answer, "食べたい");
  assert.deepEqual(hint.derivation.step1, { from: "食べる", trim: "る", add: undefined, to: "食べ" });
  assert.deepEqual(hint.derivation.step2, { from: "食べ", trim: undefined, add: "たい", to: "食べたい" });
  // Changes-requested (SAK-194 follow-up): the category/class heading flows
  // all the way through grammarHint, not just deriveProduction directly.
  assert.equal(hint.derivation.title, "る-verb / ichidan");
});

test("an UNKNOWN る-verb's derivation reads in kana — every other surface on the card does too", () => {
  // GrammarVehicle.known === false means the whole showing is drawn in kana
  // (see its doc in question.ts): building on the real 食べる would print a
  // word the learner has only ever seen as たべる on this exact card.
  const UNKNOWN = { surface: "食べる", kana: "たべる", cls: "v1", known: false } as const;
  const hint = hintFor(classProductionFactId("tai", "v1"), "en2jp", undefined, false, UNKNOWN);
  assert.ok(hint);
  assert.equal(hint.kind, "derivation");
  assert.ok(hint.kind === "derivation");
  assert.equal(hint.derivation.word, "たべる");
  assert.equal(hint.derivation.answer, "たべたい");
});

test("a KNOWN な-adjective's production derives a single equation (te-sequence adds nothing)", () => {
  // 静か (adj-na) -> 静かで (+ で). te-sequence's suffix is "", so the built
  // て-form IS the whole answer: one equation, no step 2.
  const KNOWN = { surface: "静か", kana: "しずか", cls: "adj-na", known: true } as const;
  const hint = hintFor(
    patternProductionFactId("te-sequence", "adj-na"),
    "en2jp",
    undefined,
    false,
    KNOWN,
  );
  assert.ok(hint);
  assert.equal(hint.kind, "derivation");
  assert.ok(hint.kind === "derivation");
  assert.equal(hint.derivation.word, "静か");
  assert.equal(hint.derivation.answer, "静かで");
  assert.deepEqual(hint.derivation.step1, { from: "静か", trim: undefined, add: "で", to: "静かで" });
  assert.equal(hint.derivation.step2, undefined);
  assert.equal(hint.derivation.title, "な-adjective");
});

test("an UNKNOWN な-adjective's derivation also reads in kana", () => {
  const UNKNOWN = { surface: "静か", kana: "しずか", cls: "adj-na", known: false } as const;
  const hint = hintFor(
    patternProductionFactId("te-sequence", "adj-na"),
    "en2jp",
    undefined,
    false,
    UNKNOWN,
  );
  assert.ok(hint);
  assert.equal(hint.kind, "derivation");
  assert.ok(hint.kind === "derivation");
  assert.equal(hint.derivation.word, "しずか");
  assert.equal(hint.derivation.answer, "しずかで");
});

test("a FORM recipe + KNOWN る-verb also derives — 食べる − る + ない → 食べない", () => {
  // nai-form is a form recipe (no form nudge of its own in the OLD flat text),
  // but deriveProduction does not special-case form recipes: building the
  // ない-form IS the derivation, so it still gets one equation.
  const KNOWN = { surface: "食べる", kana: "たべる", cls: "v1", known: true } as const;
  const hint = hintFor(classProductionFactId("nai-form", "v1"), "en2jp", undefined, false, KNOWN);
  assert.ok(hint);
  assert.equal(hint.kind, "derivation");
  assert.ok(hint.kind === "derivation");
  assert.equal(hint.derivation.word, "食べる");
  assert.equal(hint.derivation.answer, "食べない");
  assert.deepEqual(hint.derivation.step1, { from: "食べる", trim: "る", add: "ない", to: "食べない" });
  assert.equal(hint.derivation.step2, undefined);
});

test("the wrap recipe (shika-nai) has no derivation, so a vehicle still falls back to the flat text", () => {
  // しか〜ない's drilled host is the CLOSING verb slot, which lives on
  // recipe.wrap.close rather than recipe.attach — deriveProduction can't see
  // it (same as formHintText already can't), so grammarHint's fallback runs
  // and the class nudge is exactly where it used to be.
  const KNOWN = { surface: "食べる", kana: "たべる", cls: "v1", known: true } as const;
  assert.equal(
    textOf(
      hintFor(classProductionFactId("shika-nai", "v1"), "en2jp", undefined, false, KNOWN),
      "shika-nai + known 食べる",
    ),
    "This is the 〜しか〜ない pattern. 食べる is a る-verb",
  );
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

// ---------- the kanji reading card gets the FORMULA (task #22) ----------

test("a kanji reading fact gets a formula hint that never shows the asked reading", () => {
  // 生 in 先生 → the nudge is [先 / せん] + [生] = 先生. The OTHER piece carries
  // its reading; the asked piece (生, answer せい) is left blank, so the hint
  // points at the answer without holding it. See src/lib/reading-formula.ts.
  const hint = hintFor(readingFactId("生", "先生"), "jp2en");
  assert.ok(hint && hint.kind === "formula", "a kanji reading card is hinted");
  assert.deepEqual(hint.formula.pieces, [
    { text: "先", reading: "せん" },
    { text: "生" },
  ]);
  assert.equal(hint.formula.result, "先生");
  // The asked piece never carries せい — the answer is not in the hint.
  const asked = hint.formula.pieces.find((p) => p.text === "生");
  assert.equal(asked?.reading, undefined);
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

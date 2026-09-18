// SAK-275: the generated table of what text each reading is spoken from.
//
// Nothing here talks to VOICEVOX. The engine's answers are proved by
// scripts/build-speech-overrides.mjs --check, which re-asks it for every row
// and fails on any word whose sounds are not the expected ones. What this file
// does instead is hold the committed table still: the count, a row per kind of
// fix, the readings four earlier passes confirmed by hand, and the rule that
// every key is a reading some word is actually taught under. A regenerated
// table that quietly drops a word, or gains a key nothing speaks, fails here
// rather than in someone's ears.

import assert from "node:assert/strict";
import { test } from "node:test";

import speechOverrides from "@/data/generated/speech-overrides.json" with { type: "json" };
import { legacyUnqualifiedReading, readingUnits, VOCAB } from "@/data/vocab";
import { moraeOf } from "@/lib/pitch";
import { CONFIRMED_BAD_READINGS, readingForMisreadingFix } from "@/lib/tts-synth";

const OVERRIDES: Record<string, string> = speechOverrides;

/** Every reading the app can ask a voice for, the same three sources the
 * generator walks (see its `speechPopulation`), restated here on purpose: if
 * the two ever disagree, a key in the table is a word nothing speaks. */
function everyTaughtReading(): Set<string> {
  const readings = new Set<string>();
  for (const row of VOCAB) {
    readings.add(row.reb);
    for (const unit of readingUnits(row)) readings.add(unit.reb);
    const legacy = legacyUnqualifiedReading(row.keb);
    if (legacy) readings.add(legacy);
  }
  return readings;
}

test("the table is the size it was generated at", () => {
  assert.equal(Object.keys(OVERRIDES).length, 853);
});

test("every key is a reading a word is actually taught under", () => {
  const taught = everyTaughtReading();
  const strangers = Object.keys(OVERRIDES).filter((reading) => !taught.has(reading));
  assert.deepEqual(strangers, [], "an override for a reading nothing speaks can never be heard");
});

test("no override sends the reading back unchanged", () => {
  const pointless = Object.entries(OVERRIDES).filter(([reading, text]) => reading === text);
  assert.deepEqual(pointless, [], "a row that changes nothing is a row that should not exist");
});

test("one row per kind of fix, pinned", () => {
  // 先生: the engine leaves えい literal from any kana spelling except this one.
  assert.equal(OVERRIDES["せんせい"], "せんせー");
  // 8月: bare はちがつ comes out ワチガツ. Katakana fixes the は.
  assert.equal(OVERRIDES["はちがつ"], "ハチガツ");
  // 性癖: katakana drops the ヘ entirely (セイエキ). Spelling the long vowel out
  // as え keeps both the consonant and the smoothing.
  assert.equal(OVERRIDES["せいへき"], "せえへき");
  // 囲う: the う is the verb's own ending, and only the kanji keeps it. This
  // table cannot hold that, because かこう is 加工 too and 加工 wants the
  // smoothed カコオ. 囲う asks for a clip of its own instead, in the other
  // generated table (SAK-462, src/lib/speech-text.test.ts).
  assert.equal(OVERRIDES["かこう"], undefined, "かこう is shared with 加工, which wants the smoothed カコオ");
  assert.equal(OVERRIDES["あらそう"], "争う");
});

test("words the engine already says correctly are left alone", () => {
  // A loanword keeps the vowels it is spelled with.
  assert.equal(OVERRIDES["エイズ"], undefined);
  // は really is the particle here, and the engine knows it.
  assert.equal(OVERRIDES["こんにちは"], undefined);
  // A sound word repeats two syllables; there is no long vowel to smooth.
  assert.equal(OVERRIDES["うとうと"], undefined);
});

test("SAK-215/218/219/243: every reading confirmed by hand before this is still overridden", () => {
  const missing = HAND_CONFIRMED.filter((reading) => !(reading in OVERRIDES));
  assert.deepEqual(missing, [], "a hand-verified reading must not lose its fix to a regenerated table");
  assert.equal(HAND_CONFIRMED.length, 95);
});

test("the override keeps the reading's own number of beats, which the pitch clips count on", () => {
  // synthesizeWordWav lays a High/Low pattern over the query mora by mora, and
  // the downstep it was given was computed against the reading's own morae. A
  // text that says the word in a different number of beats would put the drop
  // in the wrong place. The generator enforces this; this pins it.
  const kanaOnly = /^[ぁ-ゟ゠-ヿー]+$/;
  const drift = Object.entries(OVERRIDES).filter(
    ([reading, text]) => kanaOnly.test(text) && moraeOf(text).length !== moraeOf(reading).length,
  );
  assert.deepEqual(drift, [], "a kana override must have the same number of morae as the reading");
});

test("readingForMisreadingFix reads this exact table, and passes anything else through", () => {
  assert.equal(readingForMisreadingFix("はちがつ"), "ハチガツ");
  assert.equal(readingForMisreadingFix("たべる"), "たべる");
  assert.deepEqual([...CONFIRMED_BAD_READINGS].sort(), Object.keys(OVERRIDES).sort());
});

/** The readings SAK-215, SAK-218, SAK-219 and SAK-243 confirmed one at a time,
 * by listening and by the kanji-context test, before SAK-275 generated the
 * whole table. They are kept here, and only here, as the regression list: the
 * generator has to keep finding a fix for every one of them.
 *
 * Nineteen of them now send a different text than they did then, for the same
 * sounds. See tts-synth.ts's own note on the accent-phrase rule that moved
 * them. That is why this pins membership and not the text. */
const HAND_CONFIRMED = [
  "はち", "は", "はは", "はで", "はば", "はだ", "はてる", "はやす", "はやめる",
  "はきょく", "はいこう", "はくがく", "はきもの", "はたいろ", "はなしごえ",
  "はみがき", "はブラシ", "はっしょう", "しはい", "このは", "たいはいてき",
  "へいはつ", "へいこう", "へいきんてき", "いどうへいきん", "ふこうへい",
  "さつ", "つかう", "じゅうさつ", "あらう", "どくさつ", "にゅうさつ", "ぶんさつ",
  "きょうそうにゅうさつ",
  "バベルのとう", "あっとう", "いちょう", "おうだんほどう", "おうじゃ", "おうこく",
  "おうじょ", "おうさま", "かんようく", "きっちょう", "ぎゃくこうか", "ぐうぞう",
  "げきどう", "けんこうてき", "こうきょうきょく", "さいしょうげん", "しつぎょう",
  "しゃこうてき", "しょうきょくてき", "しょうひしゃ", "ぞう", "せんとう",
  "せんとうき", "そうおう", "ぞうり", "ちょう", "ちょうみりょう", "ちょうとっきゅう",
  "でんわちょう", "とうおう", "とうざい", "とうわく", "どうぞう", "のうどうてき",
  "はっしょうち", "ひろうえん", "ひょうざん", "ひょうてんか", "ただよう",
  "ひょうちゃく", "ひょうり", "ふけんこう", "ふそうおう", "ふとう", "ふへんふとう",
  "ふうとう", "ほくほくとう", "ほんとう", "むじんぞう", "めんどう", "よびこう",
  "ようしゅ", "なんとう", "こうり", "ほうれんそう", "ちょうほんにん", "メモちょう",
  "あらそう", "さそう", "つくろう", "のろう",
];

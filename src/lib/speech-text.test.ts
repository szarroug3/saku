// SAK-462: the eleven words that cannot share their reading's clip.
//
// Nothing here talks to VOICEVOX. The engine's answers are proved by
// scripts/build-speech-overrides.mjs --check, which re-asks it for every row
// and fails on any word whose sounds are not the expected ones. What this file
// does is hold the committed answer still: the ten readings, which word of each
// gets a clip of its own and which keep the shared one, the sounds each side
// wants written out mora by mora, and the two things that follow from it — the
// two words hash to two different Storage paths, and NOTHING else moves.
//
// That last one is the whole safety of this change. 251,364 clips are already
// in the bucket, addressed by a hash of the text the app asked for, and only
// these eleven words ask for anything new.

import assert from "node:assert/strict";
import { test } from "node:test";

import wordOverrides from "@/data/generated/speech-word-overrides.json" with { type: "json" };
import { legacyUnqualifiedReading, readingUnits, VOCAB, vocabRow } from "@/data/vocab";
import { speechTextFor } from "@/lib/speech-text";
import { pitchObjectPath, voiceObjectPath } from "@/lib/voice";

const BY_WORD: Record<string, string> = wordOverrides;

/** The ten readings two words share without being said the same way, as the
 * engine answers them (VOICEVOX speaker 3, the local Docker engine, 2026-09-17).
 *
 * `bare` is what the engine says for the reading sent on its own, which is what
 * the shared clip holds. `own` are the words that sound different from it and
 * so send their own written form instead; `shared` are the words the clip
 * already says right, which go on sending the reading and keep the clip they
 * have. Words whose written form answers a different word entirely (陽 answers
 * ヒ, 頭 answers アタマ, 侯 answers ホオ) never had a vote and are not listed. */
const CLASHES: ReadonlyArray<{
  reading: string;
  bare: string;
  own: ReadonlyArray<{ word: string; sounds: string }>;
  shared: ReadonlyArray<{ word: string; sounds: string }>;
}> = [
  // Six readings where the VERB is the one said wrong: the う is the verb's own
  // ending, and the shared clip says it as a long o.
  { reading: "かこう", bare: "カコオ", own: [{ word: "囲う", sounds: "カコウ" }], shared: [{ word: "加工", sounds: "カコオ" }, { word: "下降", sounds: "カコオ" }, { word: "河口", sounds: "カコオ" }] },
  { reading: "そう", bare: "ソオ", own: [{ word: "沿う", sounds: "ソウ" }, { word: "添う", sounds: "ソウ" }], shared: [{ word: "想", sounds: "ソオ" }, { word: "総", sounds: "ソオ" }] },
  { reading: "いこう", bare: "イコオ", own: [{ word: "憩う", sounds: "イコウ" }], shared: [{ word: "以降", sounds: "イコオ" }, { word: "意向", sounds: "イコオ" }] },
  { reading: "よう", bare: "ヨオ", own: [{ word: "酔う", sounds: "ヨウ" }], shared: [{ word: "用", sounds: "ヨオ" }] },
  { reading: "とう", bare: "トオ", own: [{ word: "問う", sounds: "トウ" }], shared: [{ word: "党", sounds: "トオ" }, { word: "唐", sounds: "トオ" }, { word: "塔", sounds: "トオ" }] },
  { reading: "こう", bare: "コオ", own: [{ word: "乞う", sounds: "コウ" }], shared: [] },
  // And four the same shape the other way round: the shared clip already says
  // the verb right, and it is the other word, with the real long o, that needs
  // a clip of its own.
  { reading: "かよう", bare: "カヨウ", own: [{ word: "火曜", sounds: "カヨオ" }], shared: [{ word: "通う", sounds: "カヨウ" }] },
  { reading: "ひろう", bare: "ヒロウ", own: [{ word: "疲労", sounds: "ヒロオ" }], shared: [{ word: "拾う", sounds: "ヒロウ" }] },
  { reading: "やとう", bare: "ヤトウ", own: [{ word: "野党", sounds: "ヤトオ" }], shared: [{ word: "雇う", sounds: "ヤトウ" }] },
  { reading: "におう", bare: "ニオウ", own: [{ word: "仁王", sounds: "ニオオ" }], shared: [{ word: "匂う", sounds: "ニオウ" }] },
];

test("the table is the eleven words the generator found, and no others", () => {
  const expected = CLASHES.flatMap((c) => c.own.map((w) => `${w.word}|${c.reading}`)).sort();
  assert.deepEqual(Object.keys(BY_WORD).sort(), expected);
  assert.equal(expected.length, 11);
});

test("a word with its own clip sends its own written form", () => {
  for (const clash of CLASHES) {
    for (const { word } of clash.own) {
      assert.equal(speechTextFor(word, clash.reading), word, `${word} should speak its own spelling`);
    }
  }
});

test("a word the shared clip already says right goes on sending the reading", () => {
  for (const clash of CLASHES) {
    for (const { word } of clash.shared) {
      assert.equal(speechTextFor(word, clash.reading), clash.reading, `${word} should keep the shared clip`);
    }
  }
});

test("the sounds are why: a word gets its own clip exactly when it differs from the shared one", () => {
  for (const clash of CLASHES) {
    for (const { word, sounds } of clash.own) {
      assert.notEqual(sounds, clash.bare, `${word} would not need its own clip if it sounded like ${clash.bare}`);
    }
    for (const { word, sounds } of clash.shared) {
      assert.equal(sounds, clash.bare, `${word} keeps the shared clip, so it must be what the clip says`);
    }
  }
});

test("the two words of a clash resolve to two different clips, general and pitch alike", () => {
  for (const clash of CLASHES) {
    // Every clash has at least one word on each side in practice; こう's other
    // word is written in kana (the plain adverb), which is the reading itself.
    const sharedTexts = [clash.reading, ...clash.shared.map((w) => speechTextFor(w.word, clash.reading))];
    for (const { word } of clash.own) {
      const say = speechTextFor(word, clash.reading);
      for (const other of sharedTexts) {
        assert.notEqual(
          voiceObjectPath("nana", say),
          voiceObjectPath("nana", other),
          `${word} must not share a general clip with ${other}`,
        );
        // The downstep is part of a pitch clip's key too, so the comparison is
        // at ONE downstep: the same accent on two texts must still be two clips.
        assert.notEqual(
          pitchObjectPath(say, 1, "nana"),
          pitchObjectPath(other, 1, "nana"),
          `${word} must not share a pitch clip with ${other}`,
        );
      }
    }
  }
});

test("every key names a word that is really taught under that reading", () => {
  for (const key of Object.keys(BY_WORD)) {
    const [word, reading] = key.split("|");
    const row = vocabRow(word);
    assert.ok(row, `${word} is not in the vocabulary`);
    const taught = [row.reb, ...readingUnits(row).map((u) => u.reb), legacyUnqualifiedReading(word)];
    assert.ok(taught.includes(reading), `${word} is not taught under ${reading}`);
  }
});

test("nothing else moves: every other word in the corpus still speaks its reading", () => {
  const moved: string[] = [];
  for (const row of VOCAB) {
    const readings = new Set([row.reb, ...readingUnits(row).map((u) => u.reb)]);
    const legacy = legacyUnqualifiedReading(row.keb);
    if (legacy) readings.add(legacy);
    for (const reading of readings) {
      if (`${row.keb}|${reading}` in BY_WORD) continue;
      if (speechTextFor(row.keb, reading) !== reading) moved.push(`${row.keb}|${reading}`);
    }
  }
  assert.deepEqual(moved, [], "a clip path may only move for the eleven words in the table");
});

test("a caller with no word in hand gets the reading back untouched", () => {
  // A kanji's on'yomi row, a sentence, a bare kana: nothing names one word, and
  // guessing which of two words is asking would be worse than sharing the clip.
  assert.equal(speechTextFor(undefined, "かこう"), "かこう");
  assert.equal(speechTextFor(null, "かこう"), "かこう");
  assert.equal(speechTextFor("", "かこう"), "かこう");
  // And a word that never clashed is untouched whatever it is asked about.
  assert.equal(speechTextFor("先生", "せんせい"), "せんせい");
  // The key is the word AND the reading, so an override cannot leak onto
  // another reading the same word is taught under.
  assert.equal(speechTextFor("囲う", "かこう"), "囲う");
  assert.equal(speechTextFor("囲う", "かこ"), "かこ");
});

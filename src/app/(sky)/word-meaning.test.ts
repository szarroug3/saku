// Run:
//   node --conditions=react-server --import ./src/lib/conjugate/test-hooks.mjs --test "src/app/(sky)/word-meaning.test.ts"
//
// The vocabulary's word for a sentence's lemma, and the sense the sentence
// uses (SAK-508, SAK-514). The grammar page's words line and the sentence
// quiz both ask this.

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { wordInSentence } from "./word-meaning";

const said = (lemma: string, jp: string, en: string, gloss?: string) => {
  const w = wordInSentence(lemma, { jp, en, ...(gloss ? { gloss } : {}) });
  return w ? `${w.word} ${w.meaning}` : undefined;
};

describe("a verb in potential form is its dictionary verb (SAK-514)", () => {
  it("泳げる is 泳ぐ, to swim", () => {
    assert.equal(said("泳げる", "彼は泳げないらしい。", "He seems unable to swim."), "泳ぐ to swim");
  });

  it("行ける is 行く, to go, a godan verb of another class", () => {
    assert.equal(said("行ける", "日本へ行けたらいいのに。", "I wish I could go to Japan."), "行く to go");
  });

  it("話せる is 話す and 読める is 読む", () => {
    assert.equal(said("話せる", "日本語が話せる。", "I can speak Japanese."), "話す to speak");
    assert.equal(said("読める", "この本が読める。", "I can read this book."), "読む to read");
  });

  it("does not fold a verb of its own that looks like a potential", () => {
    // 付ける has the shape of 付く's potential, but it is つける, "to attach"
    assert.equal(said("付ける", "気を付けて。", "Be careful."), undefined);
  });
});

describe("the sense a sentence uses (SAK-508)", () => {
  it("prefers the word whose kanji the sentence writes", () => {
    // かく is also the kana word "to scratch"; with 書 in the sentence it is 書く
    assert.equal(said("かく", "名前を書く。", "Write your name."), "書く to write");
    assert.equal(said("かく", "背中をかく。", "I scratch my back."), "かく to scratch");
  });

  it("takes a later sense when the English says it", () => {
    assert.equal(said("休む", "静かな部屋で休みたい。", "I want to rest in a quiet room."), "休む to rest");
    assert.equal(said("遅い", "もう遅いよ。", "It's already late, I'm telling you."), "遅い late");
  });

  it("takes the sense the pattern's gloss says when the English says none", () => {
    assert.equal(said("休む", "休みたい。", "I want a break.", "rest a while"), "休む to rest");
  });

  it("does not take a later sense for a common English word", () => {
    // する's later senses include "to wear", and the English says "wearing"
    assert.equal(said("する", "最初着る前に洗濯してください。", "Wash before first wearing."), "する to do");
  });

  it("falls back on the word's first meaning", () => {
    assert.equal(said("休む", "休みたい。", "I want a break."), "休む to be absent");
  });

  it("knows nothing of a word the vocabulary does not have", () => {
    assert.equal(said("鞍", "鞍が淋しい。", "It's lonely in the saddle."), undefined);
  });
});

describe("a meaning written for the word in its sentence (SAK-516)", () => {
  const okageDe = { jp: "コンピューターのおかげで人間は馬鹿になる。", en: "Computers make people stupid." };

  it("a quiz item on the おかげで sentence glosses なる as to become", () => {
    const w = wordInSentence("なる", { id: 5138, ...okageDe });
    assert.equal(w?.meaning, "to become");
    assert.ok(w?.entry, "なる is a vocabulary word, so the quiz can tell whether it was met");
  });

  it("without the sentence's id the rules pick as before", () => {
    assert.equal(wordInSentence("なる", okageDe)?.meaning, "to bear fruit");
  });

  it("a word the vocabulary does not have gets the row, with its reading", () => {
    const w = wordInSentence("馬鹿", { id: 5138, ...okageDe });
    assert.deepEqual({ ...w }, { word: "馬鹿", reading: "ばか", meaning: "stupid" });
  });
});

// Run:
//   node --conditions=react-server --import ./src/lib/conjugate/test-hooks.mjs --test "src/app/(sky)/word-meaning.test.ts"
//
// The vocabulary's word for a sentence's lemma, and the sense the sentence
// uses (SAK-508, SAK-514). The grammar page's words line and the sentence
// quiz both ask this.

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { corpus } from "@/data/grammar/corpus";
import { wordSound } from "./prose-sound";
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

  const tameNi = { jp: "それをするためには危険を冒さなければならない。", en: "In order to do that, you have to take risks." };

  it("the row's meaning comes first: ため is in order to", () => {
    const w = wordInSentence("ため", { id: 4787, ...tameNi });
    assert.equal(w?.meaning, "in order to");
    assert.ok(w?.entry, "ため is a vocabulary word, so the quiz can tell whether it was met");
  });

  it("without the sentence's id the rules pick as before", () => {
    assert.equal(wordInSentence("ため", tameNi)?.meaning, "good");
  });

  it("a word the vocabulary does not have gets the row, with its reading", () => {
    const w = wordInSentence("馬鹿", { id: 5138, ...okageDe });
    assert.deepEqual({ ...w }, { word: "馬鹿", reading: "ばか", meaning: "stupid" });
  });
});

describe("a kana word read as several words (SAK-519)", () => {
  it("なる is to become, where the vocabulary's own なる is to bear fruit", () => {
    assert.equal(said("なる", "生まれ変わったら猫になりたい", "If I'm reincarnated, I want to come back as a cat."), "なる to become");
    assert.equal(said("なる", "雨になると思う", "Do you think that it'll rain?"), "なる to become");
  });

  it("the English still names another sense: 相手になろう is to play", () => {
    assert.equal(said("なる", "そのゲームなら相手になろう", "Two can play at that game."), "なる to play");
  });

  it("いる is to be, and still to want where the English says so", () => {
    assert.equal(said("いる", "彼らならここにいるよ", "They're here."), "いる to be");
    assert.equal(said("いる", "鉛筆がいるなら貸してあげるよ", "If you want a pencil, I'll lend you one."), "いる to want");
  });

  it("a kana word the vocabulary only writes in kanji is the one the English names", () => {
    assert.equal(said("やむ", "雨がやんだら野球をしよう", "Let's play baseball when the rain stops."), "止む to stop");
  });

  it("the English picks among them: せい is blame, and 性 nature is not", () => {
    assert.equal(said("せい", "私のせいだと思う", "Do you think I'm to blame?"), "せい blame");
    assert.equal(said("つく", "木造建築物は火がつきやすい。", "Wooden buildings catch fire easily."), "つく to catch fire");
  });

  it("nothing for a kana word with no kana spelling the English does not name", () => {
    assert.equal(said("いく", "彼女いくつだと思う", "Can you guess her age?"), undefined);
  });
});

// UniDic reads the じ of 信じて as the older サ変 verb 信ずる, so the corpus
// listed 信ずる for 信じているよ。 and the words line printed しん over 信. The
// ingest now keeps the じる verb the sentence writes (`written_base` in
// scripts/ingest/grammar.py).
describe("a じる verb the sentence writes is not its older ずる form", () => {
  const row = corpus().find((ex) => ex.id === 145741)!;

  it("信じているよ。 lists 信じる", () => {
    assert.equal(row.jp, "信じているよ。");
    assert.ok(row.v.includes("信じる"), `the corpus lists ${row.v.join(", ")}`);
    assert.ok(!row.v.includes("信ずる"));
    assert.equal(row.sp["te-iru"]?.[2], "信じる");
  });

  it("the words line says 信じる, with しんじる over it, to believe", () => {
    const w = wordInSentence("信じる", { id: row.id, jp: row.jp, en: row.en });
    assert.equal(w?.word, "信じる");
    assert.equal(w?.meaning, "to believe");
    assert.deepEqual(wordSound("信じる"), [{ text: "信", ruby: "しん" }, { text: "じる" }]);
  });

  it("no corpus sentence lists a ずる verb it writes with じ", () => {
    const wrong = corpus().flatMap((ex) =>
      ex.v.filter((l) => l.endsWith("ずる") && ex.jp.includes(l.slice(0, -2) + "じ") && !ex.jp.includes(l.slice(0, -2) + "ず")).map((l) => `${ex.id} ${ex.jp} ${l}`),
    );
    assert.deepEqual(wrong, []);
  });
});

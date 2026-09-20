// How big a Japanese prompt is drawn (SAK-390).

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { mixedRuns, optionSize, promptSize } from "@/sky/lib/japanese";

describe("promptSize", () => {
  it("draws every short prompt at the same size", () => {
    // the bug: 待つ was 64px and 食べる was 36, half a size apart for one
    // character's difference
    const sizes = ["あ", "日", "待つ", "食べる", "新しい", "いらっしゃい"].map(promptSize);
    assert.equal(new Set(sizes.slice(0, 5)).size, 1, `short prompts differ: ${sizes}`);
  });

  it("comes down as the text grows, rather than stepping", () => {
    const long = promptSize("これはとてもながいぶんしょうです");
    const longer = promptSize("これはとてもとてもながいぶんしょうですね、ほんとうに");
    assert.ok(long < promptSize("食べる"), "a sentence should be smaller than a word");
    assert.ok(longer < long, "longer should be smaller still");
  });

  it("never goes below a size that can be read", () => {
    const huge = promptSize("あ".repeat(200));
    assert.ok(huge >= 22, `${huge} is too small to read`);
  });

  it("falls smoothly, with no jump bigger than a few pixels", () => {
    let previous = promptSize("あ");
    for (let n = 2; n <= 40; n++) {
      const size = promptSize("あ".repeat(n));
      assert.ok(previous - size <= 12, `${n} characters dropped ${previous - size}px at once`);
      previous = size;
    }
  });

  it("counts characters, not code units, so a surrogate pair is one glyph", () => {
    assert.equal(promptSize("𠮷"), promptSize("あ"));
  });

  it("has an answer for an empty prompt", () => {
    assert.equal(promptSize(""), 64);
  });
});

describe("optionSize", () => {
  it("keeps the answers that fit at one size", () => {
    // a tile holds six characters at full size; past that the text comes down
    // rather than the tile growing or the word breaking
    const sizes = ["行く", "行った", "行ってから", "行ってほしい"].map(optionSize);
    assert.equal(new Set(sizes).size, 1, `answers that fit differ: ${sizes}`);
  });

  it("comes down one step at a time as the answer grows", () => {
    let previous = optionSize("行く");
    for (let n = 3; n <= 20; n++) {
      const size = optionSize("あ".repeat(n));
      assert.ok(size <= previous, `${n} characters grew instead of shrinking`);
      previous = size;
    }
  });

  it("brings the long one down rather than letting it wrap", () => {
    // the case from the card: this broke in half beside 行ってから
    assert.ok(optionSize("行ってはいけない") < optionSize("行ってから"));
  });

  it("stays readable however long the answer is", () => {
    assert.ok(optionSize("あ".repeat(40)) >= 11);
  });

  it("is smaller than a prompt, since a tile is smaller than a card", () => {
    assert.ok(optionSize("食べる") < promptSize("食べる"));
  });
});

describe("mixedRuns (SAK-443)", () => {
  const joined = (text: string) => mixedRuns(text).map((r) => r.text).join("");

  it("keeps a sentence of one face as one run", () => {
    assert.deepEqual(mixedRuns("いいえ"), [{ text: "いいえ", japanese: true }]);
    assert.deepEqual(mixedRuns("Not at all"), [{ text: "Not at all", japanese: false }]);
  });

  it("splits a note at the face it changes to", () => {
    // the case from the card: the whole note was drawn in the Japanese face
    assert.deepEqual(mixedRuns("いいえ and いや both mean no"), [
      { text: "いいえ ", japanese: true },
      { text: "and ", japanese: false },
      { text: "いや ", japanese: true },
      { text: "both mean no", japanese: false },
    ]);
  });

  it("gives the punctuation to the run it follows", () => {
    // the 。 belongs to the Japanese sentence in front of it, not to the
    // English that comes after
    assert.deepEqual(mixedRuns("今から仕事ですよ。 Time for work."), [
      { text: "今から仕事ですよ。 ", japanese: true },
      { text: "Time for work.", japanese: false },
    ]);
  });

  it("gives leading punctuation to the first run that has a face", () => {
    assert.deepEqual(mixedRuns("「いや」"), [{ text: "「いや」", japanese: true }]);
  });

  it("counts the iteration mark as Japanese, since it stands for the character before it", () => {
    assert.deepEqual(mixedRuns("時々"), [{ text: "時々", japanese: true }]);
  });

  it("reads romaji in parentheses as the English it is", () => {
    // the bracket goes with the run in front of it, which is the rule for
    // every mark: only the letters inside it decide a face
    assert.deepEqual(mixedRuns("きって (kitte)"), [
      { text: "きって (", japanese: true },
      { text: "kitte)", japanese: false },
    ]);
  });

  it("loses nothing: the runs joined are the sentence", () => {
    for (const text of [
      "いいえ and いや both mean “no,” but they aren't interchangeable.",
      "演じる and 演ずる are the same verb, written two ways.",
      "The forms are the じ ones either way: 演じます, 演じられる, 演じれば.",
      "ひらがな",
      "",
      "   ",
      "42 は number",
    ]) {
      assert.equal(joined(text), text, `runs lost characters of: ${text}`);
    }
  });

  it("has nothing to draw for an empty string", () => {
    assert.deepEqual(mixedRuns(""), []);
  });

  it("draws punctuation on its own in the UI face when nothing else is there", () => {
    assert.deepEqual(mixedRuns("..."), [{ text: "...", japanese: false }]);
  });
});

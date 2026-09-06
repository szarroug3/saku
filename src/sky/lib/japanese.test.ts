// How big a Japanese prompt is drawn (SAK-390).

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { optionSize, promptSize } from "@/sky/lib/japanese";

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

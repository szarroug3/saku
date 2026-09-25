// A line of runs cut at a span (SAK-481): the word card's underline and the
// Particle table's picked-out particle, once their sentences carry furigana.

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { cutLine } from "./sound-line";

const text = (runs: ReadonlyArray<{ text: string }>) => runs.map((r) => r.text).join("");

describe("cutLine", () => {
  // 今から仕事ですよ。 as the word card gets it, 仕事 at [3, 5)
  const line = [{ text: "今", ruby: "いま" }, { text: "から" }, { text: "仕", ruby: "し" }, { text: "事", ruby: "ごと" }, { text: "ですよ。" }];

  it("cuts around the word and keeps each reading on its kanji", () => {
    const [before, word, after] = cutLine(line, 3, 5);
    assert.equal(text(before), "今から");
    assert.deepEqual(word, [{ text: "仕", ruby: "し" }, { text: "事", ruby: "ごと" }]);
    assert.equal(text(after), "ですよ。");
  });

  it("splits a plain run where the span cuts it, and keeps its accent", () => {
    const [before, mark, after] = cutLine([{ text: "私", ruby: "わたし" }, { text: "は学", accent: true }], 1, 2);
    assert.deepEqual(before, [{ text: "私", ruby: "わたし" }]);
    assert.deepEqual(mark, [{ text: "は", accent: true }]);
    assert.deepEqual(after, [{ text: "学", accent: true }]);
  });

  it("never splits a reading: a word read as one goes to the part it starts in", () => {
    const [before, mark, after] = cutLine([{ text: "今日", ruby: "きょう" }, { text: "は" }], 1, 3);
    assert.deepEqual(before, [{ text: "今日", ruby: "きょう" }]);
    assert.deepEqual(mark, [{ text: "は" }]);
    assert.deepEqual(after, []);
  });

  it("gives back the whole line in its three parts, in order", () => {
    for (let a = 0; a <= 9; a++) for (let b = a; b <= 9; b++) assert.equal(cutLine(line, a, b).map(text).join(""), "今から仕事ですよ。");
  });
});

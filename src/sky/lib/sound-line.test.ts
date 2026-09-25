// A line of runs cut at a span (SAK-481): the word card's underline and the
// Particle table's picked-out particle, once their sentences carry furigana.

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { cutLine, kanjiRunsIn, rubyFromReading, rubyProse } from "./sound-line";

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

// SAK-484: Japanese inside English prose, and a run's whole reading split over
// its kanji.
describe("kanjiRunsIn", () => {
  it("finds each stretch of Japanese that has a kanji in it", () => {
    assert.deepEqual(kanjiRunsIn("猫は好きです is about cats. 好き, きらい and 誰か take が."), ["猫は好きです", "好き", "誰か"]);
    assert.deepEqual(kanjiRunsIn("ドアが開きます: 時々 and 〜そう 様態"), ["ドアが開きます", "時々", "様態"]);
  });
});

describe("rubyProse", () => {
  const read = (run: string) => (run === "食べる" ? [{ text: "食", ruby: "た" }, { text: "べる" }] : undefined);

  it("puts the readings over the runs it can read and leaves the rest as written", () => {
    const line = rubyProse("食べる and 飲む happen to something.", read);
    assert.deepEqual(line, [{ text: "食", ruby: "た" }, { text: "べる and 飲む happen to something." }]);
  });

  it("keeps a line with nothing to read as one run", () => {
    assert.deepEqual(rubyProse("は marks the topic.", read), [{ text: "は marks the topic." }]);
  });

  it("refuses readings that do not spell the run", () => {
    assert.deepEqual(rubyProse("食べる", () => [{ text: "食", ruby: "た" }]), [{ text: "食べる" }]);
  });
});

describe("rubyFromReading", () => {
  it("gives the kanji what is left of the reading once the kana are matched", () => {
    assert.deepEqual(rubyFromReading("見る", "みる"), [{ text: "見", ruby: "み" }, { text: "る" }]);
    assert.deepEqual(rubyFromReading("生まれる", "うまれる"), [{ text: "生", ruby: "う" }, { text: "まれる" }]);
    assert.deepEqual(rubyFromReading("私は", "わたしは"), [{ text: "私", ruby: "わたし" }, { text: "は" }]);
  });

  it("reads 時々 as one word, the way the 々 page teaches it", () => {
    assert.deepEqual(rubyFromReading("時々", "ときどき"), [{ text: "時々", ruby: "ときどき" }]);
  });

  it("splits a reading across kanji groups the kana keep apart", () => {
    assert.deepEqual(rubyFromReading("食べ物", "たべもの"), [{ text: "食", ruby: "た" }, { text: "べ" }, { text: "物", ruby: "もの" }]);
  });

  it("refuses a reading whose kana do not line up", () => {
    assert.equal(rubyFromReading("見る", "みた"), undefined);
    assert.equal(rubyFromReading("はい", "はい"), undefined);
  });
});

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { seeded } from "./random";
import { drillPool, endRun, isRight, kanjiDone, labelReading, nextKanji, rightLabel, shuffleReadings, startRun, type DrillKanji, type TableKanji } from "./readings-drill";

type Row = TableKanji["readings"][number];
const on = (reading: string, words = 10): Row => ({ reading, kind: "on", words });
const kun = (reading: string, words = 10): Row => ({ reading, kind: "kun", words });

/** What the drill makes of one kanji's rows: its readings and its group, or
 * nothing when it is skipped. */
const drilled = (readings: readonly Row[]) => drillPool([{ kanji: "x", readings }]).pool[0];
const shown = (readings: readonly Row[]) => drilled(readings)?.readings.map((r) => r.reading);

describe("voiced twins", () => {
  it("fold into their base when both are kun'yomi", () => {
    // 心 as the table has it: こころ, ごころ and しん
    assert.deepEqual(shown([kun("こころ", 11), kun("ごころ", 3), on("しん", 41)]), ["こころ", "しん"]);
    // 火: び folds into ひ, か is the on'yomi
    assert.deepEqual(shown([on("か", 18), kun("ひ", 3), kun("び", 2)]), ["か", "ひ"]);
  });

  it("give their words to the base, a handakuten twin too", () => {
    // ほ alone is three words and would be left out; with ぽ's two it is five
    assert.deepEqual(shown([kun("あ", 20), kun("ほ", 3), kun("ぽ", 2), on("しん", 10)]), ["あ", "ほ", "しん"]);
  });

  it("stay when the base is the other kind", () => {
    assert.deepEqual(shown([on("がく", 9), kun("かく", 9)]), ["がく", "かく"]);
  });

  it("never fold on'yomi: だい and たい are two readings of 大", () => {
    assert.deepEqual(shown([kun("おお", 34), on("たい", 24), on("だい", 55)]), ["おお", "たい", "だい"]);
    // 土's と is one word and goes; ど stays on its own
    assert.deepEqual(shown([kun("つち", 1), on("と", 1), on("ど", 14)]), ["つち", "ど"]);
  });
});

describe("which readings show", () => {
  it("leaves out a rare reading, except the most heard of its kind", () => {
    // 日: か (one word) goes, び folds into ひ
    assert.deepEqual(shown([kun("か", 1), on("じつ", 13), on("にち", 35), kun("ひ", 25), kun("び", 15)]), ["じつ", "にち", "ひ"]);
    // 木: こ (three words) goes, き stays
    assert.deepEqual(shown([kun("き", 6), kun("こ", 3), on("もく", 8)]), ["き", "もく"]);
    // 放: はな is rare, but it is the only kun'yomi beside a reading filed under both
    assert.deepEqual(shown([kun("はな", 4), { reading: "ほう", kind: "both", words: 14 }]), ["はな", "ほう"]);
  });
});

describe("groups", () => {
  it("count the most readings of one kind", () => {
    assert.equal(drilled([kun("みず"), on("すい")])?.tier, 1);
    assert.equal(drilled([on("じん"), on("にん"), kun("ひと")])?.tier, 2);
    assert.equal(drilled([kun("い"), kun("う"), kun("なま"), on("せい")])?.tier, 3);
  });

  it("count a reading filed under both kinds on both sides", () => {
    assert.equal(drilled([{ reading: "さ", kind: "both", words: 9 }, on("しゃ")])?.tier, 2);
  });
});

describe("drillPool", () => {
  const table = [
    { kanji: "人", readings: [on("じん", 69), kun("と", 1), on("にん", 39), kun("ひと", 25), kun("り", 8)] },
    { kanji: "本", readings: [on("ほん", 54)] },
    { kanji: "水", readings: [on("すい", 46), kun("みず", 14)] },
    { kanji: "生", readings: [kun("い", 11), kun("う", 6), on("しょう", 12), on("せい", 48), kun("なま", 4)] },
    { kanji: "差", readings: [{ reading: "さ", kind: "both" as const, words: 22 }] },
    { kanji: "木", readings: [kun("き", 6), kun("こ", 3), on("もく", 8)] },
  ];

  it("puts one of each first, then two of a kind, then three or more, the table's order inside each", () => {
    const { pool } = drillPool(table);
    assert.deepEqual(pool.map((k) => k.kanji), ["水", "木", "人", "生"]);
    assert.deepEqual(pool.map((k) => k.tier), [1, 1, 2, 2]);
  });

  it("skips a kanji with no kun'yomi or no on'yomi, or only one reading", () => {
    assert.deepEqual(drillPool(table).skipped, ["本", "差"]);
  });
});

const POOL: DrillKanji[] = [
  { kanji: "人", readings: [{ reading: "じん", kind: "on" }, { reading: "ひと", kind: "kun" }], tier: 1 },
  { kanji: "水", readings: [{ reading: "すい", kind: "on" }, { reading: "みず", kind: "kun" }, { reading: "x", kind: "both" }], tier: 2 },
];

describe("shuffleReadings", () => {
  it("keeps every reading, in an order that changes with the source", () => {
    const big: DrillKanji = { kanji: "生", readings: ["a", "b", "c", "d", "e", "f"].map((reading) => ({ reading, kind: "on" as const })), tier: 3 };
    const orders = new Set([1, 2, 3, 4, 5].map((seed) => shuffleReadings(big, seeded(seed)).map((r) => r.reading).join("")));
    for (const order of orders) assert.equal([...order].sort().join(""), "abcdef");
    assert.ok(orders.size > 1);
  });
});

describe("grading", () => {
  it("grades each reading against the table's kind", () => {
    assert.equal(isRight({ reading: "じん", kind: "on" }, "on"), true);
    assert.equal(isRight({ reading: "じん", kind: "on" }, "kun"), false);
    assert.equal(isRight({ reading: "x", kind: "both" }, "kun"), true);
    assert.equal(rightLabel({ reading: "ひと", kind: "kun" }), "kun'yomi");
    assert.equal(rightLabel({ reading: "x", kind: "both" }), "kun'yomi and on'yomi");
  });
});

describe("a run", () => {
  it("counts the score, one right and one wrong", () => {
    let run = startRun();
    run = labelReading(run, POOL, "じん", "on");
    run = labelReading(run, POOL, "ひと", "on");
    assert.deepEqual(run.score, { right: 1, labeled: 2, kanji: 1 });
    assert.equal(kanjiDone(run, POOL), true);
  });

  it("keeps the first label and ignores a second", () => {
    let run = labelReading(startRun(), POOL, "じん", "kun");
    run = labelReading(run, POOL, "じん", "on");
    assert.equal(run.labels["じん"], "kun");
    assert.deepEqual(run.score, { right: 0, labeled: 1, kanji: 1 });
  });

  it("ignores a reading the kanji showing does not have", () => {
    const run = startRun();
    assert.equal(labelReading(run, POOL, "みず", "kun"), run);
  });

  it("moves on, clears the labels, and ends past the last kanji", () => {
    let run = labelReading(startRun(), POOL, "じん", "on");
    run = nextKanji(run, POOL);
    assert.equal(run.at, 1);
    assert.deepEqual(run.labels, {});
    assert.equal(kanjiDone(run, POOL), false);
    run = labelReading(run, POOL, "みず", "kun");
    assert.deepEqual(run.score, { right: 2, labeled: 2, kanji: 2 });
    run = nextKanji(run, POOL);
    assert.equal(run.ended, true);
  });

  it("ends where it is, and takes no more labels", () => {
    let run = labelReading(startRun(), POOL, "じん", "on");
    run = endRun(run);
    assert.equal(run.ended, true);
    assert.equal(labelReading(run, POOL, "ひと", "kun"), run);
    assert.deepEqual(run.score, { right: 1, labeled: 1, kanji: 1 });
  });

  it("counts a kanji only once a reading on it is labeled", () => {
    assert.equal(nextKanji(startRun(), POOL).score.kanji, 0);
  });
});

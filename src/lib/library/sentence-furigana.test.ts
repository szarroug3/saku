import assert from "node:assert/strict";
import { test } from "node:test";

import { exampleFor } from "@/data/word-examples";
import { sentencePiecesOf } from "@/lib/library/sentence-furigana";

test("a sentence with no kanji is one text segment", () => {
  const segs = sentencePiecesOf("これはあれです。", []);
  assert.deepEqual(segs, [{ kind: "text", text: "これはあれです。" }]);
});

test("each kanji becomes its own segment, kana between them collapses", () => {
  const segs = sentencePiecesOf("私は学生です。", [
    ["私", "わたし", "わたし"],
    ["学", "がく", "がく"],
    ["生", "せい", "せい"],
  ]);
  assert.deepEqual(segs, [
    { kind: "kanji", char: "私", reading: "わたし" },
    { kind: "text", text: "は" },
    { kind: "kanji", char: "学", reading: "がく" },
    { kind: "kanji", char: "生", reading: "せい" },
    { kind: "text", text: "です。" },
  ]);
});

test("a null slot renders that one kanji bare, without disturbing its neighbours", () => {
  // 明日 (jukujikun) fails to align and is null; 雨 next to it still reads.
  const segs = sentencePiecesOf("明日は雨だ。", [null, null, ["雨", "あめ", "あめ"]]);
  assert.deepEqual(segs, [
    { kind: "kanji", char: "明", reading: null },
    { kind: "kanji", char: "日", reading: null },
    { kind: "text", text: "は" },
    { kind: "kanji", char: "雨", reading: "あめ" },
    { kind: "text", text: "だ。" },
  ]);
});

test("々 (the iteration mark) is treated as a kanji character, matching the ingest classifier", () => {
  const segs = sentencePiecesOf("人々", [["人", "ひと", "ひと"], null]);
  assert.deepEqual(segs, [
    { kind: "kanji", char: "人", reading: "ひと" },
    { kind: "kanji", char: "々", reading: null },
  ]);
});

test("a kr array shorter than the sentence's kanji count degrades to unread kanji, not a throw", () => {
  const segs = sentencePiecesOf("日本語", [["日", "に", "にち"]]);
  assert.deepEqual(segs, [
    { kind: "kanji", char: "日", reading: "に" },
    { kind: "kanji", char: "本", reading: null },
    { kind: "kanji", char: "語", reading: null },
  ]);
});

test("real generated data: every word-examples.json row's kr length matches its jp kanji count", () => {
  // Spot-checks the ingest contract end to end against the actual artifact,
  // not a hand-built fixture — catches a shape drift between
  // sentence_readings.py and this module's classifier.
  const words = ["食べる", "学校", "友達", "見る", "行く"];
  let checked = 0;
  for (const w of words) {
    const ex = exampleFor(w);
    if (!ex) continue;
    checked++;
    const kanjiCount = [...ex.jp].filter((ch) => {
      const cp = ch.codePointAt(0)!;
      return (cp >= 0x4e00 && cp <= 0x9fff) || (cp >= 0x3400 && cp <= 0x4dbf) || cp === 0x3005;
    }).length;
    assert.equal(ex.kr.length, kanjiCount, `${w}: kr length should match kanji count in "${ex.jp}"`);
  }
  assert.ok(checked > 0, "expected at least one of the sample words to have an example");
});

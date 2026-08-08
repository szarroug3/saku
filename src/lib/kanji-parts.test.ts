// Run: node --import ./src/lib/conjugate/test-hooks.mjs --test src/lib/kanji-parts.test.ts
//
// TWO THINGS ARE PINNED HERE.
//
// deframe() — the enclosure-dedup used by the shape decomposition (entries.ts's
// builtFrom): a single enclosing radical KanjiVG splits into a leading + trailing
// copy (可 = ["丁","口","丁"]) is collapsed to one frame, WITHOUT touching a
// genuine repetition (品 口口口). Unchanged by the etymology work, still exercised.
//
// teachableParts() — now DERIVED FROM THE ETYMOLOGY LAYER, not the raw shape
// decomposition. It returns the semantic + phonetic pieces `builtPieces` shows
// (src/data/kanji-etymology.ts) that a learner can actually be taught — a piece
// with a kanji card or a radical. So a bound form like 亻 (person) or 氵 (water)
// now COUNTS, because it resolves to a taught character, and a memorised whole
// (一, 人, 生) has no pieces. The pins below are the real join's output, verified
// against builtPieces — not the old KanjiVG all-or-nothing behaviour.

import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { deframe, teachableParts, teachablePieceMeaning } from "@/lib/kanji-parts";

/** The components of a teachableParts result, in order, as a plain string[]. */
function partChars(glyph: string): string[] | null {
  return teachableParts(glyph)?.map((p) => p.c) ?? null;
}

describe("deframe", () => {
  test("collapses a frame split into a leading + trailing copy", () => {
    assert.deepEqual(deframe(["丁", "口", "丁"]), ["丁", "口"]); // 可
    assert.deepEqual(deframe(["衣", "口", "衣"]), ["衣", "口"]); // 哀
    assert.deepEqual(deframe(["囗", "人", "囗"]), ["囗", "人"]); // 囚
  });

  test("collapses a frame around a MULTI-part interior, dropping only the copy", () => {
    assert.deepEqual(deframe(["衣", "口", "口", "衣"]), ["衣", "口", "口"]); // 衰
    assert.deepEqual(deframe(["囗", "⺍", "乂", "囗"]), ["囗", "⺍", "乂"]); // 図
    assert.deepEqual(deframe(["山", "幺", "幺", "山"]), ["山", "幺", "幺"]); // 幽
  });

  test("leaves a RUN of the same glyph intact — it is a real repetition", () => {
    assert.deepEqual(deframe(["口", "口", "口"]), ["口", "口", "口"]); // 品
    assert.deepEqual(deframe(["口", "口", "大", "口", "口"]), [
      "口",
      "口",
      "大",
      "口",
      "口",
    ]); // 器
    assert.deepEqual(deframe(["日", "日", "日"]), ["日", "日", "日"]); // 晶
    assert.deepEqual(deframe(["一", "一", "一"]), ["一", "一", "一"]); // 三
  });

  test("leaves a side-by-side pair intact — no interior means no frame", () => {
    assert.deepEqual(deframe(["木", "木"]), ["木", "木"]); // 林
    assert.deepEqual(deframe(["又", "又"]), ["又", "又"]); // 双
    assert.deepEqual(deframe(["火", "火"]), ["火", "火"]); // 炎
  });
});

describe("teachableParts — the etymology pieces, resolved to teachable shapes", () => {
  // A phono-semantic kanji: its semantic radical AND its phonetic kanji are both
  // teachable, so both come back — 氵 resolves to 水 (water), 可 is a kanji (can).
  test("河 is 氵 + 可", () => {
    assert.deepEqual(partChars("河"), ["氵", "可"]);
    assert.deepEqual(teachableParts("河"), [
      { c: "氵", meaning: "water" },
      { c: "可", meaning: "can" },
    ]);
  });

  // An ideogrammic kanji: two meaning pieces, both jōyō kanji.
  test("明 is 日 + 月, 校 is 木 + 交, 好 is 女 + 子", () => {
    assert.deepEqual(partChars("明"), ["日", "月"]);
    assert.deepEqual(partChars("校"), ["木", "交"]);
    assert.deepEqual(partChars("好"), ["女", "子"]);
  });

  // A BOUND FORM now counts: 亻 resolves to 人 (person), 木 is a kanji. The old
  // all-or-nothing pass returned null for 休 because 亻 has no card of its own.
  test("休 is 亻 + 木 — a bound form resolves to the character it stands for", () => {
    assert.deepEqual(partChars("休"), ["亻", "木"]);
    assert.equal(teachablePieceMeaning("亻"), "person");
  });

  // builtPieces keeps a real repetition, so teachableParts does too.
  test("品 keeps its three 口", () => {
    assert.deepEqual(partChars("品"), ["口", "口", "口"]);
  });
});

describe("teachableParts — a memorised whole has no pieces", () => {
  // No etymology role pieces at all → null → the lesson and hint show no
  // breakdown, and the number kanji stay whole.
  test("一, 人, 口, 生 are taught whole", () => {
    for (const g of ["一", "二", "十", "人", "口", "生"]) {
      assert.equal(teachableParts(g), null, `${g} should have no teachable parts`);
    }
  });
});

describe("teachablePieceMeaning", () => {
  test("a kanji's own gloss, a radical's meaning, or a variant's original", () => {
    assert.equal(teachablePieceMeaning("可"), "can"); // kanji
    assert.equal(teachablePieceMeaning("氵"), "water"); // 氵 → 水
    assert.equal(teachablePieceMeaning("亻"), "person"); // 亻 → 人
  });

  test("null for a shape that is teachable in neither sense", () => {
    // 冓 is a rare component with no kanji card and no radical — not a prereq.
    assert.equal(teachablePieceMeaning("冓"), null);
  });
});

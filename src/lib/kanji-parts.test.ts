// Run: node --import ./src/lib/conjugate/test-hooks.mjs --test src/lib/kanji-parts.test.ts
//
// The trap this closes: KanjiVG's depth-1 decomposition renders a single
// enclosing radical as its two halves, so 可 records `["丁","口","丁"]` — one 丁
// frame written twice. teachableParts() used to pass that straight through, and
// the lesson said "丁 street + 口 mouth + 丁 street". deframe() collapses that
// one split wrapper WITHOUT touching a genuine repetition, and the counterexample
// half of this file — 品 口口口, 器, 森, 晶, 三 left exactly as they were — is the
// part that matters: a blind dedupe would pass the frame cases and quietly break
// these.

import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { deframe, teachableParts } from "@/lib/kanji-parts";

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

describe("teachableParts — de-framed enclosures", () => {
  test("可 is 丁 + 口, not 丁 + 口 + 丁", () => {
    assert.deepEqual(partChars("可"), ["丁", "口"]);
  });

  test("哀 is 衣 + 口 with a single 衣 frame", () => {
    assert.deepEqual(partChars("哀"), ["衣", "口"]);
  });

  // 囚's frame 囗 is not itself a taught kanji, so the all-or-nothing gate
  // returns null — but it does so on the SINGLE de-framed 囗, not a phantom
  // trailing copy. The deframe() suite above pins that 囚 → 囗 + 人 structurally;
  // here we only confirm the gate still fires (it always did).
  test("囚 stays gated — 囗 is not a taught kanji", () => {
    assert.equal(teachableParts("囚"), null);
  });

  // Multi-level AND framed: 裏 dedupes its own 衣 frame at THIS level, and the
  // chain continues independently one level down — navigating into 里 shows 里's
  // own breakdown. Per-level dedup, no flattening across levels.
  test("裏 de-frames to 衣 + 里, and 里 keeps its own separate breakdown", () => {
    assert.deepEqual(partChars("裏"), ["衣", "里"]);
    assert.deepEqual(partChars("里"), ["日"]);
  });
});

describe("teachableParts — atomic or non-taught pieces yield nothing", () => {
  // The all-or-nothing rule the kanji page's "Built from" card rides on: a null
  // result renders no section. 一 has no components at all; 休 is 亻 + 木 but 亻
  // is a bound form with no card, so "made of 亻" is not a statement to show.
  test("一 is atomic — no built-from", () => {
    assert.equal(teachableParts("一"), null);
  });

  test("休 has a non-taught piece (亻) — no built-from", () => {
    assert.equal(teachableParts("休"), null);
  });
});

describe("teachableParts — genuine repetitions UNCHANGED", () => {
  test("品 stays three 口", () => {
    assert.deepEqual(partChars("品"), ["口", "口", "口"]);
  });

  test("器 keeps all four 口 around 大", () => {
    assert.deepEqual(partChars("器"), ["口", "口", "大", "口", "口"]);
  });

  test("森 stays 木 + 林", () => {
    assert.deepEqual(partChars("森"), ["木", "林"]);
  });
});

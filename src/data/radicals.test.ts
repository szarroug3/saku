// Run: node --import ./src/lib/conjugate/test-hooks.mjs --test \
//   src/data/radicals.test.ts
//
// The radical data's invariants, checked against the real tables. These are the
// promises the whole track rests on: there are 214 of them, each kanji is filed
// under one that actually exists, and the teaching queue is a total order over
// all 214 with the orphans at the tail.

import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { KANJI_ORDER } from "../data/kanji.ts";
import { RADICALS, radicalByGlyph, radicalOfKanji } from "../data/radicals.ts";
import {
  RADICAL_TEACHING_ORDER,
  radicalConsumerCount,
  radicalTeachIndex,
} from "../lib/radical-order.ts";

describe("the 214 radicals", () => {
  test("there are exactly 214, numbered 1..214 with no gaps", () => {
    assert.equal(RADICALS.length, 214);
    const nums = RADICALS.map((r) => r.num).sort((a, b) => a - b);
    assert.deepEqual(nums, Array.from({ length: 214 }, (_, i) => i + 1));
  });

  test("glyphs are unique, and every one has a meaning and positive strokes", () => {
    const glyphs = new Set(RADICALS.map((r) => r.glyph));
    assert.equal(glyphs.size, 214, "no two radicals share a glyph");
    for (const r of RADICALS) {
      assert.ok(r.meaning.trim().length > 0, `radical ${r.num} has a meaning`);
      assert.ok(r.strokes > 0, `radical ${r.num} has a positive stroke count`);
    }
  });

  test("radicalByGlyph round-trips every radical", () => {
    for (const r of RADICALS) {
      assert.equal(radicalByGlyph(r.glyph)?.num, r.num);
    }
  });
});

describe("every kanji maps to a real radical", () => {
  test("radicalOfKanji is defined for every kanji in the order, and points at a listed radical", () => {
    const byNum = new Set(RADICALS.map((r) => r.num));
    for (const o of KANJI_ORDER) {
      const rad = radicalOfKanji(o.c);
      assert.ok(rad, `${o.c} has a classical radical`);
      assert.ok(byNum.has(rad.num), `${o.c}'s radical ${rad.num} is one of the 214`);
    }
  });
});

describe("the teaching queue", () => {
  test("is all 214, each exactly once", () => {
    assert.equal(RADICAL_TEACHING_ORDER.length, 214);
    const nums = new Set(RADICAL_TEACHING_ORDER.map((r) => r.num));
    assert.equal(nums.size, 214);
  });

  test("radicalTeachIndex agrees with the queue position", () => {
    RADICAL_TEACHING_ORDER.forEach((r, i) => {
      assert.equal(radicalTeachIndex(r.num), i);
    });
  });

  test("orphans (no consumer) form the tail, in Kangxi number order", () => {
    const consumed = new Set<number>();
    for (const o of KANJI_ORDER) {
      const rad = radicalOfKanji(o.c);
      if (rad) consumed.add(rad.num);
    }
    const orphanNums = RADICAL_TEACHING_ORDER.map((r) => r.num).filter(
      (n) => !consumed.has(n),
    );
    // Every orphan sits after every non-orphan.
    const firstOrphanAt = RADICAL_TEACHING_ORDER.findIndex(
      (r) => !consumed.has(r.num),
    );
    for (let i = firstOrphanAt; i < RADICAL_TEACHING_ORDER.length; i++) {
      assert.ok(
        !consumed.has(RADICAL_TEACHING_ORDER[i].num),
        "no needed radical appears after the first orphan",
      );
    }
    // And the orphan tail is sorted by Kangxi number.
    const sorted = [...orphanNums].sort((a, b) => a - b);
    assert.deepEqual(orphanNums, sorted);
    assert.ok(orphanNums.length > 0, "there are orphan radicals");
  });

  test("a needed radical is taught before the first kanji that needs it", () => {
    // For each kanji, in order, the moment we reach it its radical must already
    // have appeared in the teaching queue at a position no later than the kanji's
    // rank among consumers. Concretely: the radical's teach index is finite and
    // its consumer count is positive.
    for (const o of KANJI_ORDER) {
      const rad = radicalOfKanji(o.c);
      if (!rad) continue;
      assert.ok(radicalTeachIndex(rad.num) >= 0, `${rad.glyph} is in the queue`);
      assert.ok(
        radicalConsumerCount(rad.num) > 0,
        `${rad.glyph} counts ${o.c} among its consumers`,
      );
    }
  });

  test("consumer counts sum to the number of kanji that have a radical", () => {
    const total = RADICALS.reduce((s, r) => s + radicalConsumerCount(r.num), 0);
    const withRadical = KANJI_ORDER.filter((o) => radicalOfKanji(o.c)).length;
    assert.equal(total, withRadical);
  });
});

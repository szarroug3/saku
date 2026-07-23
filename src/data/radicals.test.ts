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
import {
  RADICALS,
  isRadicalTaughtAsKanji,
  radicalByGlyph,
  radicalOfKanji,
} from "../data/radicals.ts";
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
  test("is exactly the radicals NOT taught as their own kanji, each once", () => {
    // The queue used to be all 214; it is now the 98 the radical TRACK teaches,
    // the merged both-roles characters (乙, 一, 人 …) having moved to the kanji
    // card. So the queue is precisely the radicals for which isRadicalTaughtAsKanji
    // is false, with no duplicates and none of the merged ones.
    const expected = RADICALS.filter((r) => !isRadicalTaughtAsKanji(r.num)).map(
      (r) => r.num,
    );
    const got = RADICAL_TEACHING_ORDER.map((r) => r.num);
    assert.equal(got.length, expected.length);
    assert.equal(new Set(got).size, got.length, "each radical appears once");
    assert.deepEqual(new Set(got), new Set(expected));
    for (const r of RADICALS) {
      assert.equal(
        RADICAL_TEACHING_ORDER.some((q) => q.num === r.num),
        !isRadicalTaughtAsKanji(r.num),
        `radical ${r.num} is in the queue iff it is not taught as a kanji`,
      );
    }
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

  test("a needed radical is taught before the first kanji that needs it — as a radical card or as its own kanji", () => {
    // Every kanji's radical must be met before the kanji. Two ways now: a
    // non-merged radical is in the teaching queue (a radical card ahead of it); a
    // merged radical IS its own kanji, its glyph the earliest kanji filed under
    // it, so it lands in the kanji order no later than any kanji that needs it.
    for (const o of KANJI_ORDER) {
      const rad = radicalOfKanji(o.c);
      if (!rad) continue;
      if (isRadicalTaughtAsKanji(rad.num)) continue; // taught on the kanji card
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

describe("radicals taught once, as their own kanji (the dedup)", () => {
  const ORDER_INDEX = new Map(KANJI_ORDER.map((o) => [o.c, o.i]));

  test("乙 — the owner's example — is one of them", () => {
    const otsu = radicalByGlyph("乙");
    assert.ok(otsu, "乙 is a radical");
    assert.ok(
      isRadicalTaughtAsKanji(otsu!.num),
      "乙 is taught as the kanji, not a separate radical card",
    );
  });

  test("a merged radical's glyph is a taught kanji AND its own first consumer", () => {
    for (const r of RADICALS) {
      if (!isRadicalTaughtAsKanji(r.num)) continue;
      const own = ORDER_INDEX.get(r.glyph);
      assert.ok(own !== undefined, `${r.glyph} is a taught jōyō kanji`);
      // No kanji filed under this radical is reached before the radical's own
      // glyph — which is why merging it into a single kanji lesson teaches no
      // component before it is met.
      for (const o of KANJI_ORDER) {
        if (radicalOfKanji(o.c)?.num === r.num) {
          assert.ok(
            ORDER_INDEX.get(o.c)! >= own!,
            `${o.c} (radical ${r.num}) is not reached before ${r.glyph}`,
          );
        }
      }
    }
  });

  test("the 8 both-roles characters needed early stay as radical cards", () => {
    // Each is needed as a component before its own kanji is reached in the
    // everyday order (火 for 点, 玉 for 王 …), so it keeps its early radical card
    // and is NOT merged. Merging them would teach a shape before the kanji it is
    // part of — 玉 before its own component 王.
    for (const glyph of ["八", "小", "己", "火", "玉", "示", "肉", "阜"]) {
      const r = radicalByGlyph(glyph);
      assert.ok(r, `${glyph} is a radical`);
      assert.equal(
        isRadicalTaughtAsKanji(r!.num),
        false,
        `${glyph} is not merged`,
      );
      assert.ok(
        RADICAL_TEACHING_ORDER.some((q) => q.num === r!.num),
        `${glyph} still appears in the radical teaching queue`,
      );
    }
  });

  test("every radical is taught exactly once — queue and kanji cards partition the 214", () => {
    const inQueue = new Set(RADICAL_TEACHING_ORDER.map((r) => r.num));
    const asKanji = RADICALS.filter((r) => isRadicalTaughtAsKanji(r.num)).map(
      (r) => r.num,
    );
    // Disjoint, and together the whole 214.
    for (const n of asKanji) assert.ok(!inQueue.has(n), `${n} not in both`);
    assert.equal(inQueue.size + asKanji.length, 214);
  });
});

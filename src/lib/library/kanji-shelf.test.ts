// Run: node --import ./src/lib/conjugate/test-hooks.mjs --test \
//        src/lib/library/kanji-shelf.test.ts
//
// WHAT THESE TESTS ARE FOR
// ========================
// The Kanji shelf is cut by the order the reader is studying in. Two things can
// go wrong and neither is visible in one function:
//
//   1. THE CUT LOSES OR REPEATS KANJI. Sections are slices of a 2,136-long
//      order; an off-by-one drops the last one, or shows 一 twice. So: the
//      sections must tile the whole set exactly — no gap, no overlap, no
//      duplicate — in every mode.
//   2. THE TILES COME OUT IN THE WRONG ORDER. The whole point is that reading
//      the shelf is reading the queue, so concatenating the sections must
//      reproduce the STUDY ORDER exactly, not merely contain the same glyphs.
//      For the range modes that order is now the curriculum CLIMB
//      (curriculumPosition), not kanjiTeachOrder — so 人 opens the shelf, kanji 1
//      on the Learn card. `grade` still concatenates to its own grade-teach
//      order. This is the half that a "does it have 2,136 things" test misses.

import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { KANJI, kanjiTeachOrder } from "@/data/kanji";
import { curriculumPosition } from "@/lib/curriculum-order";
import { KANJI_CHUNK, kanjiCuts } from "@/lib/library/kanji-shelf";
import type { NewKanjiOrder } from "@/types";

const MODES: readonly NewKanjiOrder[] = ["everyday", "grade", "newspaper"];
const TOTAL = 2136;

/** The study order the shelf reads in, per mode. `grade` keeps its grade-teach
 * order; the range modes read in the climb — every jōyō kanji sorted by where
 * the Learn feed reaches it (curriculumPosition, unique per glyph and covering
 * all 2,136, so both range modes yield this one order). */
function expectedOrder(mode: NewKanjiOrder): string[] {
  if (mode === "grade") return [...kanjiTeachOrder("grade")];
  return [...kanjiTeachOrder(mode)].sort(
    (a, b) => curriculumPosition(a) - curriculumPosition(b),
  );
}

describe("kanjiCuts", () => {
  test("the whole jōyō set is 2,136, in every order", () => {
    assert.equal(KANJI.length, TOTAL);
    for (const mode of MODES) assert.equal(kanjiTeachOrder(mode).length, TOTAL);
  });

  for (const mode of MODES) {
    describe(mode, () => {
      const cuts = kanjiCuts(mode);
      const flat = cuts.flatMap((c) => c.glyphs);

      test("tiles the whole set: no gap, no overlap, no duplicate", () => {
        assert.equal(flat.length, TOTAL, "every kanji appears");
        assert.equal(new Set(flat).size, TOTAL, "and appears once");
        // No gap: the set covered is the set that exists.
        const have = new Set(flat);
        for (const k of KANJI) assert.ok(have.has(k.c), `missing ${k.c}`);
      });

      test("concatenating the sections reproduces the study order", () => {
        assert.deepEqual(flat, expectedOrder(mode));
      });

      test("the first section starts with the order's first kanji", () => {
        assert.equal(cuts[0].glyphs[0], expectedOrder(mode)[0]);
      });

      test("section ids are unique", () => {
        assert.equal(new Set(cuts.map((c) => c.id)).size, cuts.length);
      });

      test("no jargon: nothing says jōyō", () => {
        for (const c of cuts) assert.ok(!/jōyō/i.test(c.label), c.label);
      });
    });
  }

  test("everyday and newspaper cut into 43 range sections of 50, tail of 36", () => {
    for (const mode of ["everyday", "newspaper"] as const) {
      const cuts = kanjiCuts(mode);
      assert.equal(cuts.length, 43);
      for (const c of cuts.slice(0, 42)) assert.equal(c.glyphs.length, KANJI_CHUNK);
      assert.equal(cuts[42].glyphs.length, 36);
      // Labels are ranges, with an EN DASH, and they are contiguous.
      assert.equal(cuts[0].label, "1–50");
      assert.equal(cuts[1].label, "51–100");
      assert.equal(cuts[42].label, "2101–2136");
    }
  });

  test("人 is the first kanji after the six opening kana words", () => {
    // 人 is spine item 0 (see curriculum-order.ts), so the climb puts it first
    // where frequency once buried it.
    assert.equal(curriculumPosition("人"), 6);
    for (const mode of ["everyday", "newspaper"] as const) {
      assert.equal(kanjiCuts(mode)[0].glyphs[0], "人");
    }
  });

  test("every range label describes the slice it actually holds", () => {
    let seen = 0;
    for (const c of kanjiCuts("everyday")) {
      assert.equal(c.label, `${seen + 1}–${seen + c.glyphs.length}`);
      seen += c.glyphs.length;
    }
    assert.equal(seen, TOTAL);
  });

  test("grade keeps grade sections, relabelled, with no grade 7", () => {
    const cuts = kanjiCuts("grade");
    assert.deepEqual(
      cuts.map((c) => c.label),
      [1, 2, 3, 4, 5, 6, 8].map((g) => `School grade ${g}`),
    );
    assert.deepEqual(
      cuts.map((c) => c.glyphs.length),
      [80, 160, 200, 202, 193, 191, 1110],
    );
  });

  test("grade sections hold exactly their own grade", () => {
    const gradeOf = new Map(KANJI.map((k) => [k.c, k.grade]));
    for (const c of kanjiCuts("grade")) {
      const g = Number(c.id.slice("grade-".length));
      for (const glyph of c.glyphs) assert.equal(gradeOf.get(glyph), g);
    }
  });

  test("everyday and newspaper cuts are flagged isRangeLabel — the label is a bare span, not a category", () => {
    for (const mode of ["everyday", "newspaper"] as const) {
      for (const c of kanjiCuts(mode)) assert.equal(c.isRangeLabel, true);
    }
  });

  test("grade cuts are NOT flagged isRangeLabel — School grade N is a real category", () => {
    for (const c of kanjiCuts("grade")) assert.equal(c.isRangeLabel, undefined);
  });
});

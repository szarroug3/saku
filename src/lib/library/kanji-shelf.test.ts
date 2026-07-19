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
//      reproduce kanjiTeachOrder EXACTLY, not merely contain the same glyphs.
//      This is the half that a "does it have 2,136 things" test misses.

import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { KANJI, kanjiTeachOrder } from "@/data/kanji";
import { KANJI_CHUNK, kanjiCuts } from "@/lib/library/kanji-shelf";
import type { NewKanjiOrder } from "@/types";

const MODES: readonly NewKanjiOrder[] = ["everyday", "grade", "newspaper"];
const TOTAL = 2136;

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

      test("concatenating the sections reproduces the teach order", () => {
        assert.deepEqual(flat, [...kanjiTeachOrder(mode)]);
      });

      test("the first section starts with the order's first kanji", () => {
        assert.equal(cuts[0].glyphs[0], kanjiTeachOrder(mode)[0]);
      });

      test("section ids are unique", () => {
        assert.equal(new Set(cuts.map((c) => c.id)).size, cuts.length);
      });

      test("no jargon: nothing says jōyō", () => {
        for (const c of cuts) assert.ok(!/jōyō/i.test(c.label), c.label);
      });
    });
  }

  test("everyday and newspaper cut into 22 range sections of 100, tail of 36", () => {
    for (const mode of ["everyday", "newspaper"] as const) {
      const cuts = kanjiCuts(mode);
      assert.equal(cuts.length, 22);
      for (const c of cuts.slice(0, 21)) assert.equal(c.glyphs.length, KANJI_CHUNK);
      assert.equal(cuts[21].glyphs.length, 36);
      // Labels are ranges, with an EN DASH, and they are contiguous.
      assert.equal(cuts[0].label, "1–100");
      assert.equal(cuts[1].label, "101–200");
      assert.equal(cuts[21].label, "2101–2136");
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
});

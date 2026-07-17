// Run: node --test --experimental-strip-types \
//        --import ./src/lib/conjugate/test-hooks.mjs src/lib/glyph-fit.test.ts
//
// WHAT THESE TESTS ARE FOR
// ========================
// The drill halo has a fixed inner diameter, and the glyph has to fit ONE line
// inside it. The failure mode is not a crash — it is a word wrapping to two
// lines or spilling past the ring. So these tests are about the boundary: a
// single glyph is left alone, longer content shrinks, and the shrink both fits
// the budget and never drops below the floor.
//
// GLYPH_PX (78) is the drill's Japanese base size; the latin side is 0.6× that.
// Both are passed in as `base`, so the tests use the same two numbers the drill
// screen does rather than reaching into the component.

import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  GLYPH_FIT_PX,
  GLYPH_MIN_PX,
  fitGlyphSize,
} from "./glyph-fit.ts";

const JP_BASE = 78;
const EN_BASE = Math.round(JP_BASE * 0.6);

/** A jp glyph's estimated one-line width at a given size — the same 1.05
 * advance the module uses, so "does it fit" is asserted on the module's own
 * terms rather than a second guess at font metrics. */
function jpWidth(chars: number, size: number): number {
  return chars * 1.05 * size;
}

describe("fitGlyphSize", () => {
  test("a single glyph is never shrunk", () => {
    assert.equal(fitGlyphSize("あ", true, JP_BASE), JP_BASE);
    assert.equal(fitGlyphSize("生", true, JP_BASE), JP_BASE);
    // A lone latin character keeps the latin base too.
    assert.equal(fitGlyphSize("a", false, EN_BASE), EN_BASE);
  });

  test("empty content is left at the base rather than dividing by zero", () => {
    assert.equal(fitGlyphSize("", true, JP_BASE), JP_BASE);
  });

  test("a short word that already fits keeps the base size", () => {
    // Two full-width chars at 78px is ~164px — over the 150 budget, so it DOES
    // scale. Pick a case that fits: the latin base is small enough that a short
    // romaji answer stays put.
    assert.equal(fitGlyphSize("ni", false, EN_BASE), EN_BASE);
  });

  test("あなた scales down to one line inside the halo", () => {
    const size = fitGlyphSize("あなた", true, JP_BASE);
    assert.ok(size < JP_BASE, "three chars must be smaller than the base");
    assert.ok(
      jpWidth(3, size) <= GLYPH_FIT_PX + 1,
      `あなた at ${size}px is ${jpWidth(3, size)}px wide, over the ${GLYPH_FIT_PX}px budget`,
    );
  });

  test("先生 fits on one line", () => {
    const size = fitGlyphSize("先生", true, JP_BASE);
    assert.ok(jpWidth(2, size) <= GLYPH_FIT_PX + 1);
  });

  test("the longest everyday phrase still fits inside the ring hole", () => {
    // ありがとうございます — 10 chars, the top of the everyday range.
    const phrase = "ありがとうございます";
    assert.equal([...phrase].length, 10);
    const size = fitGlyphSize(phrase, true, JP_BASE);
    // The ring hole is 168px across (radius 84); one line must clear it.
    assert.ok(
      jpWidth(10, size) <= 168,
      `10 chars at ${size}px is ${jpWidth(10, size)}px, wider than the 168px hole`,
    );
    assert.ok(size >= GLYPH_MIN_PX, "never below the floor");
  });

  test("a phrase long enough to need less than the floor sits at the floor", () => {
    // 15 full-width chars (advanced, past the beginner track): the ideal size
    // would be under the floor, so it clamps and accepts slight overflow.
    const long = "あ".repeat(15);
    assert.equal(fitGlyphSize(long, true, JP_BASE), GLYPH_MIN_PX);
  });

  test("never returns a size above the base", () => {
    for (let n = 1; n <= 20; n++) {
      const size = fitGlyphSize("あ".repeat(n), true, JP_BASE);
      assert.ok(size <= JP_BASE && size >= GLYPH_MIN_PX);
    }
  });
});

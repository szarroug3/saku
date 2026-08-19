// Run: node --import ./src/lib/conjugate/test-hooks.mjs --test src/lib/font-detect.test.ts
//
// isFontAvailable() has no real browser to check against here, so this mocks
// CanvasRenderingContext2D.measureText itself: a fake `document` whose canvas
// context returns metrics keyed off whatever font string it was asked to
// draw. That's enough to pin the one thing that was actually broken — a
// pure-kana/kanji sample measures the SAME WIDTH in every CJK-capable face
// (full-width glyphs are standardized that way), so on a real machine the
// control (a bogus family that must fall back) and every genuinely-installed
// candidate tied on width and the row reported zero fonts. These tests prove
// the fix discriminates even when width alone would collide.

import assert from "node:assert/strict";
import { before, describe, test } from "node:test";

import { availableFonts, isFontAvailable } from "./font-detect.ts";

interface FakeMetrics {
  width: number;
  ascent: number;
  descent: number;
}

/** What the browser produces when it didn't recognize the family and fell
 * back to `monospace` (+ system CJK fallback for the kana/kanji half). Every
 * unregistered family — including the module's own bogus control string —
 * measures as this. */
const FALLBACK: FakeMetrics = { width: 200, ascent: 28, descent: 6 };

/** family string (exactly what font-detect.ts passes to `ctx.font`, minus the
 * "32px " prefix and ", monospace" suffix) -> the metrics a real installed
 * face with that name would report. Tests populate this before calling the
 * module so each font string maps to fixed, known metrics. */
const registry = new Map<string, FakeMetrics>();

function metricsFor(fontCss: string): FakeMetrics {
  const family = fontCss.replace(/^32px /, "").replace(/, monospace$/, "");
  return registry.get(family) ?? FALLBACK;
}

class FakeCanvasContext {
  font = "";
  measureText(_text: string) {
    const m = metricsFor(this.font);
    return {
      width: m.width,
      actualBoundingBoxAscent: m.ascent,
      actualBoundingBoxDescent: m.descent,
    } as TextMetrics;
  }
}

before(() => {
  // font-detect.ts only touches `document.createElement("canvas")` and
  // `.getContext("2d")` — a minimal stand-in is enough, and node:test runs
  // outside jsdom so nothing else defines `document` to collide with.
  (globalThis as { document?: unknown }).document = {
    createElement(tag: string) {
      if (tag !== "canvas") throw new Error(`unexpected element: ${tag}`);
      return {
        getContext(kind: string) {
          return kind === "2d" ? new FakeCanvasContext() : null;
        },
      };
    },
  };
});

describe("isFontAvailable", () => {
  test("a family that ties the control on every metric is reported unavailable", () => {
    // Nothing registered for this name, so it measures as FALLBACK — exactly
    // like the bogus control does. This is "truly not installed".
    assert.equal(isFontAvailable("'NeverInstalled'"), false);
  });

  test("a family that differs only in the Latin/digit width is available", () => {
    // Same vertical metrics as the fallback (plausible: similar font size),
    // but its own proportional Latin glyphs give it a different total width
    // than monospace's Latin glyphs — the case a mixed sample exists for.
    registry.set("'RealGothic'", { width: 214, ascent: 28, descent: 6 });
    assert.equal(isFontAvailable("'RealGothic'"), true);
  });

  test("a family that ties on width but differs in vertical metrics is available", () => {
    // The headline scenario: if the sample were pure kana/kanji, full-width
    // standardization means a real face can plausibly land on the SAME width
    // as the fallback purely by coincidence of the CJK portion. Vertical
    // metrics are what still catches it — a Mincho face's glyph box isn't a
    // Gothic fallback's.
    registry.set("'RealMincho'", { width: 200, ascent: 31, descent: 9 });
    assert.equal(isFontAvailable("'RealMincho'"), true);
  });

  test("a family within epsilon of the control on every metric is unavailable", () => {
    // Sub-pixel noise, not a real distinction — must not count as installed.
    registry.set("'NoiseOnly'", { width: 200.3, ascent: 28.2, descent: 5.8 });
    assert.equal(isFontAvailable("'NoiseOnly'"), false);
  });

  test("results are cached per family", () => {
    registry.set("'Cached'", { width: 500, ascent: 40, descent: 10 });
    assert.equal(isFontAvailable("'Cached'"), true);
    // Mutate the registry entry after the first call — a cached result must
    // not re-measure.
    registry.set("'Cached'", { width: 200, ascent: 28, descent: 6 });
    assert.equal(isFontAvailable("'Cached'"), true);
  });

  test("no document (SSR) assumes available rather than hiding everything", () => {
    const saved = (globalThis as { document?: unknown }).document;
    delete (globalThis as { document?: unknown }).document;
    try {
      assert.equal(isFontAvailable("'AnyFamily'"), true);
    } finally {
      (globalThis as { document?: unknown }).document = saved;
    }
  });
});

describe("availableFonts", () => {
  test("filters a font list down to the installed subset", () => {
    registry.set("'Installed1'", { width: 300, ascent: 28, descent: 6 });
    registry.set("'Installed2'", { width: 200, ascent: 33, descent: 6 });
    // 'Missing' is left unregistered -> measures as FALLBACK -> unavailable.
    const result = availableFonts(["'Installed1'", "'Missing'", "'Installed2'"]);
    assert.deepEqual(result, ["'Installed1'", "'Installed2'"]);
  });
});

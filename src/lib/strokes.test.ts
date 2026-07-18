// Run: node --import ./src/lib/conjugate/test-hooks.mjs --test \
//        src/lib/strokes.test.ts
//
// The stroke-order asset (src/data/generated/strokes/hiragana.json, generated
// by scripts/ingest/kanjivg.mjs from KanjiVG) is what the "how it's written"
// section draws. These pin the contract the renderer relies on:
//
//   - it parses, and every base hiragana is present;
//   - the five vowels have real, ordered stroke data, one number label per
//     stroke (numbers[i] labels strokes[i]);
//   - a glyph with no data yet — a katakana, a kanji — is simply absent, which
//     the loader turns into null and the section renders as the whole-shape
//     fallback rather than crashing.
//
// The lookup is read straight off the JSON here (the hook that wraps it is React
// and untestable in this harness, exactly like lesson-prefs); the behaviour that
// matters lives in the data shape, and that is what this checks.

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, test } from "node:test";

interface GlyphStrokes {
  strokes: string[];
  numbers: [number, number][];
}

const ASSET = fileURLToPath(
  new URL("../data/generated/strokes/hiragana.json", import.meta.url),
);
const DATA = JSON.parse(readFileSync(ASSET, "utf-8")) as Record<
  string,
  GlyphStrokes | undefined
>;

/** How the loader answers a lookup: the entry, or null when a glyph has no
 * data (see useGlyphStrokes in strokes.ts). */
function lookup(glyph: string): GlyphStrokes | null {
  return DATA[glyph] ?? null;
}

const VOWELS = [..."あいうえお"];
const ALL_BASE = [
  ..."あいうえおかきくけこさしすせそたちつてとなにぬねのはひふへほまみむめもやゆよらりるれろわをん",
];

describe("stroke-order asset", () => {
  test("all 46 base hiragana are present", () => {
    assert.equal(ALL_BASE.length, 46);
    for (const g of ALL_BASE) {
      assert.ok(lookup(g), `missing stroke data for ${g}`);
    }
  });

  test("the vowels load with ordered strokes and aligned number labels", () => {
    for (const v of VOWELS) {
      const entry = lookup(v);
      assert.ok(entry, `missing ${v}`);
      // Real strokes: at least one, every one a non-empty SVG path starting M.
      assert.ok(entry.strokes.length >= 1, `${v} has no strokes`);
      for (const d of entry.strokes) {
        assert.equal(typeof d, "string");
        assert.match(d, /^M/, `${v} stroke isn't a path: ${d.slice(0, 12)}`);
      }
      // One number label per stroke, each an [x, y] pair on the 109 grid.
      assert.equal(
        entry.numbers.length,
        entry.strokes.length,
        `${v}: ${entry.numbers.length} labels for ${entry.strokes.length} strokes`,
      );
      for (const [x, y] of entry.numbers) {
        assert.ok(x >= 0 && x <= 109 && y >= 0 && y <= 109, `${v} label off-grid`);
      }
    }
  });

  test("known stroke counts are right (あ is 3, し is 1)", () => {
    assert.equal(lookup("あ")!.strokes.length, 3);
    assert.equal(lookup("し")!.strokes.length, 1);
  });

  test("a glyph with no data degrades to null, not a throw", () => {
    // Katakana and kanji aren't ingested yet — the loader returns null and the
    // section falls back to the whole-shape view.
    assert.equal(lookup("ア"), null); // katakana 'a'
    assert.equal(lookup("水"), null); // kanji
    assert.equal(lookup(""), null); // the collapsed sentinel
  });
});

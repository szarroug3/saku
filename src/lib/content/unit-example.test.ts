// Run: node --import ./src/lib/conjugate/test-hooks.mjs --test src/lib/content/unit-example.test.ts

import assert from "node:assert/strict";
import test from "node:test";

import { exampleFor } from "./unit-example.ts";
import { teachUnitsOf } from "./teach-unit.ts";
import { buildGlyphItem } from "./build-item.ts";

test("exampleFor — 人 read にん → an anchor word that contains 人 and reads にん, with a gloss", () => {
  const nin = teachUnitsOf(buildGlyphItem("人")!).find((u) => u.reading === "にん")!;
  const ex = exampleFor(nin);
  assert.ok(ex, "the にん unit has an example");
  // A counter/compound like 人間 — a real word demonstrating 人 read にん.
  assert.ok(ex!.word.includes("人"), `the example word contains the glyph (${ex!.word})`);
  assert.notEqual(ex!.word, "人", "the anchor is a compound, not the bare glyph");
  assert.ok(typeof ex!.gloss === "string" && ex!.gloss.length > 0, "it carries a gloss");
});

test("exampleFor — 三 read さん → a word (三 itself here), with a gloss", () => {
  const san = teachUnitsOf(buildGlyphItem("三")!).find((u) => u.reading === "さん")!;
  const ex = exampleFor(san);
  assert.ok(ex, "the さん unit has an example");
  assert.ok(ex!.word.includes("三"), `the example word contains the glyph (${ex!.word})`);
  assert.equal(ex!.gloss, "three", "三's gloss");
});

test("exampleFor — a meaning-only unit (reading null) → null", () => {
  const units = teachUnitsOf(buildGlyphItem("又")!);
  const meaningOnly = units.find((u) => u.reading === null)!;
  assert.ok(meaningOnly, "又 has a reading-null unit");
  assert.equal(exampleFor(meaningOnly), null);
});

test("exampleFor — every non-null example word contains its unit's glyph", () => {
  let examples = 0;
  let units = 0;
  for (const glyph of ["人", "三", "一", "日", "口"]) {
    for (const unit of teachUnitsOf(buildGlyphItem(glyph)!)) {
      units += 1;
      const ex = exampleFor(unit);
      if (ex) {
        examples += 1;
        assert.ok(
          ex.word.includes(unit.glyph),
          `${glyph}/${unit.reading}: example ${ex.word} contains the glyph`,
        );
      }
    }
  }
  assert.equal(examples, units, "every reading-bearing unit of these glyphs resolves an example");
});

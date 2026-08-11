// Run:
//   node --import ./src/lib/conjugate/test-hooks.mjs --test src/data/radical-names.test.ts
//
// The accuracy contract for the radical enrichment (bushu names + variant
// forms). Every one of the 214 Kangxi radicals must resolve a name, the known
// values must be exactly right, and every variant glyph must be a single,
// real CJK ideograph — the data another track will build on, so it is guarded
// rather than trusted.

import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { RADICALS, bushuName, radicalVariants, radicalByGlyph } from "./radicals.ts";

/** A single CJK unified or extension ideograph (not a Kangxi-block / CJK
 * Radicals Supplement / PUA / compatibility codepoint). */
function isSingleCjk(glyph: string): boolean {
  const cps = Array.from(glyph);
  if (cps.length !== 1) return false;
  const cp = cps[0].codePointAt(0)!;
  return (
    (cp >= 0x3400 && cp <= 0x4dbf) || // Extension A
    (cp >= 0x4e00 && cp <= 0x9fff) || // Unified Ideographs
    (cp >= 0x20000 && cp <= 0x2fa1f) // Extension B..F + compat supplement
  );
}

describe("radical bushu names", () => {
  test("all 214 radicals resolve a bushu name", () => {
    assert.equal(RADICALS.length, 214);
    for (const r of RADICALS) {
      const name = bushuName(r.glyph);
      assert.ok(name, `radical ${r.num} (${r.glyph}) has no bushu name`);
      assert.ok(name.kana.length > 0, `radical ${r.num} name has empty kana`);
      assert.ok(name.romaji.length > 0, `radical ${r.num} name has empty romaji`);
    }
  });

  test("base names for known radicals", () => {
    assert.deepEqual(bushuName("禾"), { kana: "のぎへん", romaji: "nogihen" });
    assert.deepEqual(bushuName("水"), { kana: "みず", romaji: "mizu" });
  });

  test("bushuName resolves variant glyphs to their own name", () => {
    assert.deepEqual(bushuName("氵"), { kana: "さんずい", romaji: "sanzui" });
    assert.deepEqual(bushuName("亻"), { kana: "にんべん", romaji: "ninben" });
    assert.deepEqual(bushuName("刂"), { kana: "りっとう", romaji: "rittou" });
  });

  test("null for a glyph that is neither radical nor variant", () => {
    assert.equal(bushuName("愛"), null);
    assert.equal(bushuName("x"), null);
  });
});

describe("radical variant forms", () => {
  test("水 / 氵 — variants include 氵 (さんずい) and 氺 (したみず)", () => {
    const variants = radicalVariants("水");
    const glyphs = variants.map((v) => v.glyph);
    assert.ok(glyphs.includes("氵"), `水 variants missing 氵: ${glyphs.join(" ")}`);
    assert.ok(glyphs.includes("氺"), `水 variants missing 氺: ${glyphs.join(" ")}`);
    const sanzui = variants.find((v) => v.glyph === "氵");
    assert.deepEqual(sanzui!.name, { kana: "さんずい", romaji: "sanzui" });
  });

  test("亻 is a variant of 人, named にんべん", () => {
    const ninben = radicalVariants("人").find((v) => v.glyph === "亻");
    assert.ok(ninben, "人 has no 亻 variant");
    assert.deepEqual(ninben!.name, { kana: "にんべん", romaji: "ninben" });
  });

  test("刂 is a variant of 刀, named りっとう", () => {
    const rittou = radicalVariants("刀").find((v) => v.glyph === "刂");
    assert.ok(rittou, "刀 has no 刂 variant");
    assert.deepEqual(rittou!.name, { kana: "りっとう", romaji: "rittou" });
  });

  test("忄 (心) and 扌 (手) resolve as variants", () => {
    assert.ok(radicalVariants("心").some((v) => v.glyph === "忄"));
    assert.ok(radicalVariants("手").some((v) => v.glyph === "扌"));
  });

  test("every variant glyph is a single CJK ideograph, distinct from its base", () => {
    for (const r of RADICALS) {
      for (const v of radicalVariants(r.glyph)) {
        assert.ok(
          isSingleCjk(v.glyph),
          `variant ${v.glyph} of radical ${r.num} (${r.glyph}) is not a single CJK codepoint`,
        );
        assert.notEqual(v.glyph, r.glyph, `variant of ${r.glyph} equals its base`);
        assert.ok(v.name.kana.length > 0 && v.name.romaji.length > 0);
      }
    }
  });

  test("a variant glyph is never itself another radical's base glyph", () => {
    for (const r of RADICALS) {
      for (const v of radicalVariants(r.glyph)) {
        const owner = radicalByGlyph(v.glyph);
        assert.equal(
          owner,
          undefined,
          `variant ${v.glyph} of ${r.glyph} is the base glyph of radical ${owner?.num}`,
        );
      }
    }
  });
});

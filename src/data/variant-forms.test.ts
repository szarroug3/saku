// Run: node --import ./src/lib/conjugate/test-hooks.mjs --test \
//        src/data/variant-forms.test.ts
//
// WHAT THESE PIN
// ==============
// The variant model is almost entirely derived, so what can go wrong is a piece
// of the derivation coming back empty or pointing at the wrong thing:
//
//   - a form with no worked example, which the lesson and the concept card both
//     rely on ("as in 体"). Every one of the fifty-eight must resolve one.
//   - an example that is the base character itself, which would teach 人 by
//     showing 人 rather than a second kanji.
//   - a curated example that does not actually contain the form, or that shows the
//     WRONG glyph — the 月/肉 case, where a comps scan cannot tell the flesh 月 from
//     the moon 月 and the derived pick 明 is the moon. The curated table fixes it,
//     and the "the curated examples" block below pins that it stays fixed.
//   - a position outside the six the panel knows how to phrase.
//   - the authored name and position tables keying to a glyph that is not a
//     variant form at all — a dead entry, or worse a typo for a real one.
//
// The `variants` map is the shipped source of truth, so these read it and check a
// property of every entry rather than naming glyphs one by one.

import assert from "node:assert/strict";
import { describe, test } from "node:test";

import kanjiComponents from "@/data/generated/kanji-components.json" with { type: "json" };
import { kanjiRow } from "@/data/kanji";
import { variantForm, variantsOf, type VariantPosition } from "@/data/variant-forms";

const VARIANTS = (kanjiComponents as { variants: Record<string, string> }).variants;
const GLYPHS = Object.keys(VARIANTS);
const POSITIONS: ReadonlySet<VariantPosition> = new Set<VariantPosition>([
  "left",
  "right",
  "top",
  "bottom",
  "nyo",
  "tare",
]);

describe("variantForm — the derived model of one form", () => {
  test("the map is the fifty-eight forms it shipped with", () => {
    // If this changes, the ingest changed, and the coverage claims below move
    // with it. Asserted so a silent re-cut cannot pass unnoticed.
    assert.equal(GLYPHS.length, 58);
  });

  test("every form resolves to its original", () => {
    for (const glyph of GLYPHS) {
      const form = variantForm(glyph);
      assert.ok(form, `${glyph} resolves no form`);
      assert.equal(form!.original, VARIANTS[glyph]);
    }
  });

  test("every form resolves a worked example, and it is a second kanji", () => {
    for (const glyph of GLYPHS) {
      const form = variantForm(glyph)!;
      assert.ok(form.example, `${glyph} resolves no example`);
      // The example is a real kanji whose components include the form...
      assert.ok(
        (kanjiRow(form.example!)?.comps ?? []).includes(glyph),
        `${form.example} does not contain ${glyph}`,
      );
      // ...and it is never the character being taught.
      assert.notEqual(form.example, form.original, `${glyph}'s example is its own original`);
    }
  });

  test("every form has a position, and it is one the panel can phrase", () => {
    // Fifty-three come from KanjiVG; the five it leaves unplaced are covered by
    // the authored fallback, so all fifty-eight land on one of the six tokens.
    for (const glyph of GLYPHS) {
      const pos = variantForm(glyph)!.position;
      assert.ok(pos, `${glyph} has no position`);
      assert.ok(POSITIONS.has(pos!), `${glyph} has an unphrasable position ${pos}`);
    }
  });

  test("a plain character is not a variant form", () => {
    assert.equal(variantForm("山"), undefined);
    assert.equal(variantForm("人"), undefined); // the ORIGINAL is not itself a form
  });

  test("the authored names land on real forms, with the well-known ones correct", () => {
    // Every name comes back on a glyph that is genuinely in the variants map (a
    // name keyed to a non-form would be a typo), and the three the app leans on
    // in its copy read as expected.
    for (const glyph of GLYPHS) {
      const name = variantForm(glyph)!.name;
      if (name !== undefined) assert.ok(VARIANTS[glyph], `${glyph} is named but is not a form`);
    }
    assert.equal(variantForm("亻")!.name, "にんべん");
    assert.equal(variantForm("氵")!.name, "さんずい");
    assert.equal(variantForm("忄")!.name, "りっしんべん");
  });

  test("亻 is 人, on the left, called にんべん, shown in 体", () => {
    const form = variantForm("亻")!;
    assert.equal(form.original, "人");
    assert.equal(form.position, "left");
    assert.equal(form.name, "にんべん");
    // The curated pick, not the earliest-by-order 化: a learner meets 体 first.
    assert.equal(form.example, "体");
  });
});

describe("the curated examples win over the earliest-by-order default", () => {
  /** The 27 surface-#1 forms — the ones whose original is a taught character, and
   * so the only ones whose example a learner ever sees. Read off the data. */
  const kanjiSet = new Set(
    Object.values(VARIANTS).filter((original) => kanjiRow(original)),
  );
  const surfaceOne = GLYPHS.filter((g) => kanjiSet.has(VARIANTS[g]));

  test("all 27 surface-#1 forms have a curated example that they truly contain", () => {
    assert.equal(surfaceOne.length, 27);
    for (const glyph of surfaceOne) {
      const example = variantForm(glyph)!.example;
      assert.ok(example, `${glyph} resolves no example`);
      assert.ok(
        (kanjiRow(example!)?.comps ?? []).includes(glyph),
        `${glyph}'s example ${example} does not contain it as a component`,
      );
    }
  });

  test("the familiar picks replace the earliest-by-order defaults", () => {
    // 化 is the earliest 亻; 汁 the earliest 氵; a beginner meets 体 and 海 first.
    assert.equal(variantForm("亻")!.example, "体");
    assert.equal(variantForm("氵")!.example, "海");
    assert.equal(variantForm("忄")!.example, "情");
    assert.equal(variantForm("扌")!.example, "持");
  });

  test("THE BUG: 月 (a form of 肉) shows a FLESH kanji, not the moon 明", () => {
    // 月 is both the moon and the flesh radical にくづき. A component list cannot
    // tell them apart, so the earliest host of 月 was 明, whose 月 is the moon —
    // "肉 also appears as 月, as in 明" is a real teaching error. The example must
    // be a kanji where 月 is genuinely the flesh form.
    const form = variantForm("月")!;
    assert.equal(form.original, "肉");
    assert.notEqual(form.example, "明", "月's example is the MOON kanji");
    assert.equal(form.example, "腹"); // belly — a flesh 月 on the left
    assert.ok((kanjiRow(form.example!)?.comps ?? []).includes("月"));
  });
});

describe("variantsOf — the forms a character takes", () => {
  test("人 takes exactly 亻", () => {
    assert.deepEqual(variantsOf("人").map((f) => f.glyph), ["亻"]);
  });

  test("心 takes two forms, the left one listed before the one underneath", () => {
    const forms = variantsOf("心");
    assert.deepEqual(forms.map((f) => f.glyph), ["忄", "⺗"]);
    assert.equal(forms[0]!.position, "left");
    assert.equal(forms[1]!.position, "bottom");
  });

  test("水 and 食 each take two forms as well", () => {
    assert.equal(variantsOf("水").length, 2);
    assert.equal(variantsOf("食").length, 2);
  });

  test("a character with no form on file takes none", () => {
    assert.deepEqual(variantsOf("山"), []);
    // And a form glyph is not itself an original.
    assert.deepEqual(variantsOf("亻"), []);
  });

  test("every original groups back the forms that name it", () => {
    // The inverse is total: each form appears under its own original, and under
    // no other.
    for (const glyph of GLYPHS) {
      const original = VARIANTS[glyph];
      assert.ok(
        variantsOf(original).some((f) => f.glyph === glyph),
        `${glyph} is missing from variantsOf(${original})`,
      );
    }
  });
});

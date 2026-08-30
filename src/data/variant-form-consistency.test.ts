// Run: node --import ./src/lib/conjugate/test-hooks.mjs --test \
//   src/data/variant-form-consistency.test.ts
//
// TWO SHAPES, ONE CONCEPT (SAK-288 / Audit 07)
// =============================================
// radicals.ts and variant-forms.ts each carry an independent representation of
// "a character's positional variant form" — 水 becomes 氵 on the left of 海, 心
// becomes 忄 on the left of 情 — and nothing has ever checked that the two agree.
//
//   radicals.ts's VariantForm   curated from Kanji Alive (radical-enrichment.
//                               json), scoped to the 214 Kangxi radicals, names
//                               a position as a RadicalName ({kana, romaji}).
//   variant-forms.ts's VariantForm  derived from KanjiVG's kvg:original
//                               (kanji-components.json), scoped to the 58
//                               components KanjiVG records one for — most, but
//                               not all, radicals — names a position as a
//                               six-value string enum plus a bare kana string.
//
// A consumer reading the radical page (character-entry-content.ts, via
// radicalVariants) and a consumer reading a kanji's "Built from" note
// (entries.ts / lesson-roles.ts / question.ts, via variantForm/variantsOf) can
// therefore be told two different things about what is, to a learner, the same
// fact — with nothing short of a human re-reading both generated JSONs to catch
// drift.
//
// WHY THIS IS A CHECK, NOT A MERGE
// =================================
// The two sources are not two encodings of one table: they genuinely differ in
// SCOPE and PROVENANCE, by design (see the doc comments atop each file), and at
// least two kinds of real divergence exist between them TODAY:
//
//   COVERAGE — radical-enrichment.json is Kanji Alive's curated pocket and is
//   incomplete on purpose wherever Kanji Alive has not curated a form. Radical
//   96 (玉) ships zero curated variants (radicalVariants("玉") === []) even
//   though KanjiVG independently derives, and this app separately and
//   correctly teaches, 王 as 玉's おうへん form (variant-forms.ts's own
//   EXPECTED_VARIANT_ORIGIN and NAME tables, pinned in variant-forms.test.ts).
//   Folding that into radicals.ts would mean asserting Kanji Alive itself
//   curates 王 for radical 96, which it verifiably does not — inventing a
//   citation the licensed source does not carry.
//
//   ENCODING — at least three of the same real bushu are shipped under
//   DIFFERENT Unicode code points by the two pipelines, and Unicode defines no
//   compatibility fold between them (checked: NFKC leaves each unchanged):
//   けものへん is 犭 U+72AD in radical-enrichment.json but ⺨ U+2E68 in
//   kanji-components.json; つめかんむり is 爫 U+722B here but ⺤ U+2EA4 there;
//   しんにょう is exactly the 辶/⻌ pairing that radicals.ts's own WRITTEN_FORM
//   comment already flags as needing "a verified curated source" before it can
//   be bridged. Building that third equivalence table on the spot would be
//   guessing at exactly the kind of curation call this codebase already
//   declines to make speculatively.
//
//   SEMANTIC SCOPE — radical 47 (巛) lists 川 as its curated bushu form
//   (さんぼんがわ), which is correct in Kanji Alive's sense: 川 is how the
//   classical radical is actually drawn. But variant-forms.ts's own audit
//   (see its EXCLUDED table) deliberately drops 川 as a KanjiVG mislabel,
//   because KanjiVG's narrower definition of "variant form" means a REDUCED
//   positional shape (水→氵), and 川 is not a reduction of 巛 at all — it is
//   the unreduced glyph, and the arrow KanjiVG draws points backwards (川 is
//   the primary, taught kanji; 巛 is the archaic curved shape). The two files
//   are answering different questions about the same pair, not contradicting
//   each other, so this is excluded from the comparison rather than asserted
//   equal.
//
// So this file does not converge the shapes. It checks the thing that IS
// mechanically checkable without inventing new curated content: wherever the
// two sources use the LITERAL SAME glyph as a variant form, they must agree on
// which base character it is a form of, and on the Japanese name wherever both
// assign one. That holds today over a real, non-trivial, pinned set of shared
// glyphs, and it will fail the moment either generated JSON repoints one of
// them relative to the other — which is exactly the silent-drift risk SAK-288
// exists to close off.

import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { RADICALS, radicalVariants } from "./radicals.ts";
import { variantForm } from "./variant-forms.ts";

/** One curated radical variant (radicals.ts) paired with whatever variant-forms
 * .ts independently knows about the identical glyph, if anything. */
interface Shared {
  readonly radicalGlyph: string;
  readonly variantGlyph: string;
  readonly curatedName: string;
}

const ALL_CURATED: Shared[] = RADICALS.flatMap((r) =>
  radicalVariants(r.glyph).map((v) => ({
    radicalGlyph: r.glyph,
    variantGlyph: v.glyph,
    curatedName: v.name.kana,
  })),
);

// Only the pairs where variant-forms.ts ALSO resolves this exact glyph are
// comparable at all — see ENCODING and COVERAGE above for why most of the 37
// curated rows have nothing on the other side to agree or disagree with.
const SHARED: Shared[] = ALL_CURATED.filter(
  (p) => variantForm(p.variantGlyph) !== undefined,
);

// The exact set of glyphs both sources currently price in, pinned the way this
// codebase pins the other cross-source maps (see variant-forms.test.ts's
// EVERY_GLYPH): a silent drop from either generated JSON — say kanji-
// components.json stops carrying 氵 — would otherwise just quietly shrink the
// comparison instead of failing anything.
const EXPECTED_SHARED_GLYPHS: ReadonlySet<string> = new Set([
  "亻", "刂", "忄", "扌", "攵", "斉", "旡", "氵", "氺", "灬", "礻", "耂",
  "艹", "衤", "覀", "飠", "麦", "黒", "歯",
]);

describe("radicals.ts and variant-forms.ts agree wherever they share a glyph", () => {
  test("the shared set is exactly the nineteen glyphs both sources currently price in", () => {
    assert.deepEqual(new Set(SHARED.map((p) => p.variantGlyph)), EXPECTED_SHARED_GLYPHS);
    assert.equal(SHARED.length, EXPECTED_SHARED_GLYPHS.size, "no glyph is curated twice for one radical");
  });

  for (const pair of SHARED) {
    test(`${pair.radicalGlyph}'s curated variant ${pair.variantGlyph} names the same original and name in variant-forms.ts`, () => {
      const derived = variantForm(pair.variantGlyph)!;
      assert.equal(
        derived.original,
        pair.radicalGlyph,
        `${pair.variantGlyph}: radicals.ts says a form of ${pair.radicalGlyph}, variant-forms.ts says ${derived.original}`,
      );
      // variant-forms.ts's `name` is optional (untitled forms are taught by
      // position only); only compare where it actually asserts one.
      if (derived.name !== undefined) {
        assert.equal(
          derived.name,
          pair.curatedName,
          `${pair.variantGlyph}: radicals.ts names it ${pair.curatedName}, variant-forms.ts names it ${derived.name}`,
        );
      }
    });
  }

  test("known cross-source gaps stay exactly as documented, not silently fixed or worsened", () => {
    // COVERAGE: radical 96 (玉) still ships no curated variant, even though
    // variant-forms.ts independently teaches 王 as its おうへん form. If this
    // ever starts passing on its own, radicals.ts's data grew a curated 王 entry
    // and the comment above (and this assertion) should be updated to say so —
    // not deleted, so the next drift is still caught.
    assert.deepEqual(radicalVariants("玉"), []);
    const wangForm = variantForm("王");
    assert.ok(wangForm, "王 should still be a known variant form in variant-forms.ts");
    assert.equal(wangForm!.original, "玉");
    assert.equal(wangForm!.name, "おうへん");

    // ENCODING: the differently-coded bushu pairs are not accidentally the same
    // codepoint (which would mean the "encoding difference" excuse above is
    // stale and the pair belongs in SHARED instead).
    for (const [hereGlyph, thereGlyph] of [
      ["犭", "⺨"], // けものへん
      ["爫", "⺤"], // つめかんむり
    ] as const) {
      assert.notEqual(hereGlyph, thereGlyph);
      assert.equal(variantForm(hereGlyph), undefined, `${hereGlyph} unexpectedly resolves in variant-forms.ts now`);
      assert.ok(variantForm(thereGlyph), `${thereGlyph} should still be variant-forms.ts's spelling`);
    }

    // SEMANTIC SCOPE: 川 is still radical 47's curated bushu form here, and
    // still excluded on the other side as a reversed-direction mislabel — the
    // two files are answering different questions, not disagreeing.
    assert.ok(
      radicalVariants("巛").some((v) => v.glyph === "川"),
      "巛 should still list 川 as a curated variant",
    );
    assert.equal(variantForm("川"), undefined, "川 should still be excluded in variant-forms.ts");
  });
});

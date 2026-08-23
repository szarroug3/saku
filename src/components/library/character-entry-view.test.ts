// Run: node --import ./src/lib/conjugate/test-hooks.mjs --test \
//        src/components/library/character-entry-view.test.ts
//
// SAK-146: "Vocab lessons with multi-type units that include radical are not
// showing the radical section."
//
// CharacterEntryView decides whether to render the "As a radical" block with
//   hasRadical = variants.length > 0 || (isRadical && !isKanji && !isWord)
// — i.e. the block only showed for a multi-role glyph (radical AND kanji, or
// radical AND word) when the radical also happened to have recorded variant
// forms (氵/氺 for 水). A radical with no variant form — 一, 二, 入, 八, 力, 十,
// 口, 土, 大, 女, 子, 小, and the great majority of the 214 Kangxi radicals —
// lost its "As a radical" section entirely the moment it was ALSO a kanji or a
// word, which is exactly the "multi-type unit" the ticket describes. The fix
// drops the variants requirement for a multi-role glyph: the block shows
// whenever `isRadical` is true and there is real content to show, which is
// unconditionally true because `radicalMeaning` (every radical row has a
// required, non-optional meaning — see radicals.ts) is populated whenever
// `isRadical` is.
//
// This module is "use client" and this runner has no React harness (see
// counter-entry-view.test.ts / kana-entry-view.test.ts for the same
// constraint), so this file verifies the fix the same two ways those do:
// behaviourally — the data `hasRadical` reads (roles, radicalMeaning) is what
// it's assumed to be for real multi-role glyphs with no variant forms — and
// structurally — the source no longer contains the buggy gate.

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, test } from "node:test";

import { RADICALS, radicalByGlyph, radicalVariants } from "@/data/radicals";
import { kanjiRow } from "@/data/kanji";
import { characterRoles } from "@/lib/character-role";
import { buildGlyphItem } from "@/lib/content/build-item.ts";
import { characterEntryPayload } from "@/lib/library/character-entry-content.ts";

const SOURCE = readFileSync(
  fileURLToPath(new URL("./character-entry-view.tsx", import.meta.url)),
  "utf8",
);

// Multi-role radicals (radical + kanji, or radical + kanji + word) with no
// recorded variant form — the exact shape of unit the old gate dropped.
const noVariantMultiRole = RADICALS.filter((r) => {
  const roles = characterRoles(r.glyph);
  return roles.length > 1 && radicalVariants(r.glyph).length === 0;
}).map((r) => r.glyph);

describe("SAK-146 — the radical section for a multi-type unit", () => {
  test("plenty of real radicals are multi-role with no variant forms (the bug's exact shape)", () => {
    assert.ok(
      noVariantMultiRole.length > 50,
      `expected many multi-role, variant-less radicals; found ${noVariantMultiRole.length}`,
    );
    for (const glyph of ["一", "二", "入", "八", "力", "十", "口", "土", "大", "女", "子", "小"]) {
      assert.ok(
        noVariantMultiRole.includes(glyph),
        `${glyph} should be a multi-role radical with no variant forms`,
      );
    }
  });

  test("every one of those glyphs plays the radical role AND at least one other role", () => {
    for (const glyph of noVariantMultiRole) {
      const roles = characterRoles(glyph);
      assert.ok(roles.includes("radical"), `${glyph} should play the radical role`);
      assert.ok(
        roles.includes("kanji") || roles.includes("word"),
        `${glyph} should play a second role`,
      );
      // Confirm it's really taught as a kanji too, not just radical-tagged.
      if (roles.includes("kanji")) assert.ok(kanjiRow(glyph), `${glyph} should have a kanji row`);
    }
  });

  test("radicalMeaning — what hasRadical falls back on — is populated for every one of them", () => {
    // This is what makes `hasRadical = isRadical && (radicalMeaning !== null || …)`
    // equivalent to `isRadical` in practice: a radical row's meaning is a
    // required field (see radicals.ts), never absent for a real radical glyph.
    for (const glyph of noVariantMultiRole) {
      const row = radicalByGlyph(glyph);
      assert.ok(row, `${glyph} should resolve a radical row`);
      assert.equal(typeof row!.meaning, "string");
      assert.ok(row!.meaning.length > 0, `${glyph}'s radical meaning should be non-empty`);
    }
  });

  test("the source no longer gates a multi-role radical's section on having variant forms", () => {
    assert.doesNotMatch(
      SOURCE,
      /variants\.length > 0 \|\| \(isRadical && !isKanji && !isWord\)/,
      "hasRadical must not require variant forms for a multi-role glyph — SAK-146",
    );
    assert.match(
      SOURCE,
      /const hasRadical = isRadical/,
      "hasRadical should render whenever the glyph plays the radical role",
    );
  });
});

// ---- SAK-155: the "As a radical" block renders the single-radical tip ----
//
// Same constraint as SAK-146 above (no React harness for this "use client"
// module): verified behaviourally (the payload 勹's page actually gets has a
// non-null radicalTip) and structurally (the source renders it).

describe("SAK-155 — 勹's radical page renders its recognition tip", () => {
  test("勹's own payload carries a non-null radicalTip", () => {
    const item = buildGlyphItem("勹");
    assert.ok(item, "勹 should build a ContentItem");
    const payload = characterEntryPayload(item!);
    assert.ok(payload.radicalTip, "勹 should carry a radicalTip");
  });

  test("the source destructures and renders radicalTip inside the radical block", () => {
    assert.match(
      SOURCE,
      /const \{ kanjiMeaning, radicalMeaning, radicalTip \} = payload;/,
      "CharacterEntryView should read radicalTip off the payload",
    );
    assert.match(
      SOURCE,
      /\{radicalTip \? \(/,
      "the 'As a radical' block should conditionally render radicalTip",
    );
  });
});

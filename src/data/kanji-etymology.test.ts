// Run: node --import ./src/lib/conjugate/test-hooks.mjs --test \
//        src/data/kanji-etymology.test.ts
//
// WHAT THESE PIN
// ==============
// The etymology layer joins Wiktionary's per-component FUNCTION+SENSE onto the
// KanjiVG shape pieces the app already shows. The two failure modes worth
// guarding are the two the brief calls out:
//
//   1. A real join is LOST — 肝's 月 should read semantic (flesh), 河's 氵
//      semantic (water). If the variant-form normalisation regresses (氵≠水,
//      ⺼≠月≠肉), these silently go unlabelled and the feature empties out.
//   2. A piece is MISLABELLED — 服's visible 月 is a corruption of 舟 that
//      matches NEITHER Wiktionary component (凡, 𠬝). It must stay unlabelled.
//      The moment a stray 月 on the page earns a "flesh" tag, the layer is
//      lying, which is the one thing this codebase refuses to do.

import assert from "node:assert/strict";
import test from "node:test";

import {
  builtFromRoles,
  builtPieces,
  etymologyOf,
  hasEtymology,
  phoneticReading,
} from "./kanji-etymology.ts";
import { kanjiRow } from "./kanji.ts";

/** The role assigned to a specific shape piece of a kanji, or null. */
function roleOf(kanji: string, piece: string) {
  const comps = kanjiRow(kanji)?.comps ?? [];
  const roles = builtFromRoles(kanji);
  const idx = comps.indexOf(piece);
  return idx === -1 ? undefined : roles[idx];
}

test("肝 — ⺼/月 is semantic (flesh), 干 is phonetic", () => {
  const flesh = roleOf("肝", "月");
  assert.ok(flesh, "肝's 月 piece got no role");
  assert.equal(flesh.function, "semantic");
  assert.match(flesh.sense ?? "", /flesh/i);

  const kan = roleOf("肝", "干");
  assert.ok(kan, "肝's 干 piece got no role");
  assert.equal(kan.function, "phonetic");

  assert.equal(etymologyOf("肝")?.type, "phono-semantic");
});

test("明 — 日 and 月 are BOTH semantic, 月's sense is the moon", () => {
  const hi = roleOf("明", "日");
  const tsuki = roleOf("明", "月");
  assert.ok(hi && tsuki, "明's pieces did not both resolve");
  assert.equal(hi.function, "semantic");
  assert.equal(tsuki.function, "semantic");
  assert.match(tsuki.sense ?? "", /moon/i);
  // Ideogrammic, not phono-semantic — 明 has no phonetic component.
  assert.equal(etymologyOf("明")?.type, "ideogrammic");
  assert.ok(!builtFromRoles("明").some((r) => r?.function === "phonetic"));
});

test("河 — 氵 is semantic (water piece), 可 is phonetic and lends か", () => {
  const water = roleOf("河", "氵");
  assert.ok(water, "河's 氵 piece got no role — 氵↔水 normalisation broke");
  assert.equal(water.function, "semantic");
  // The best-aligned theory is 水 + 可 (可 present in the shape); the rival
  // 水 + 何 carries the "water" gloss but 何 is not in 河, so it loses. That
  // leaves 氵 semantic with no gloss here — which is correct, not a miss.
  assert.equal(water.matched, "水");

  const ka = roleOf("河", "可");
  assert.ok(ka, "河's 可 piece got no role — the 水+何 theory was picked over 水+可");
  assert.equal(ka.function, "phonetic");

  // 可 lends its sound to 河: both read か. This is the phonetic-reading join.
  assert.equal(phoneticReading("河", "可"), "か");
  const pieces = builtPieces("河");
  assert.deepEqual(
    pieces.map((p) => [p.glyph, p.role, p.label]),
    [
      ["氵", "semantic", null],
      ["可", "phonetic", "か"],
    ],
  );
});

test("服 — the visible 月 stays UNLABELLED (it matches neither 凡 nor 𠬝)", () => {
  // 服 has an etymology, but its KanjiVG pieces (月, 卩, 又) align to none of
  // Wiktionary's components (凡, 𠬝). Every piece must be null — no guessing.
  assert.ok(hasEtymology("服"));
  const roles = builtFromRoles("服");
  assert.ok(
    roles.every((r) => r === null),
    "a 服 shape piece was labelled despite matching no Wiktionary component",
  );
  assert.equal(roleOf("服", "月") ?? null, null);
});

test("pictographs (人, 山) have no phono-semantic components", () => {
  for (const c of ["人", "山"]) {
    const roles = builtFromRoles(c);
    assert.ok(
      !roles.some((r) => r?.function === "phonetic"),
      `${c} produced a phonetic component — a pictograph has none`,
    );
    // Nothing semantic/phonetic to label: a pictograph's own shape is atomic.
    const etym = etymologyOf(c);
    assert.ok(
      !etym || !etym.components.some((k) => k.function === "phonetic"),
      `${c} carries a phonetic component in its record`,
    );
  }
});

test("林 — the doubled-tree explanation survives cleaning in plain voice", () => {
  const etym = etymologyOf("林");
  assert.ok(etym, "林 has no etymology record");
  assert.equal(etym.type, "ideogrammic");
  // Both 木 pieces labelled semantic (tree).
  const roles = builtFromRoles("林");
  assert.equal(roles.length, 2);
  assert.ok(roles.every((r) => r?.function === "semantic"));
  // The plain-language origin is preserved, not paraphrased.
  assert.match(etym.originText ?? "", /doubled 木/);
});

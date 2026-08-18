// Run: node --import ./src/lib/conjugate/test-hooks.mjs --test src/data/yoon-rows.test.ts
//
// SAK-72 Part B reads this file's `yoonRowFor` straight into the Library page
// for a yōon kana — the "Composition" block on きゃ's own page (KanaEntryView,
// see its ComboSection). This pins the two guarantees that block depends on:
//
//   - yoonRowFor resolves every one of the 72 taught combos (36 per script),
//     with the right [base, small] split and the entry's own reading, and
//     resolves to null for anything that isn't one of them (a base kana, a
//     dakuten/handakuten kana, an untaught string);
//   - YOON_ROWS is DERIVED off CHAR_INDEX, not a second hand-typed table, so a
//     combo characters.ts teaches is automatically a row here too.
//
// getMnemonic/yoonConfusables reuse and the COMBO_H/COMBO_K prose reuse are
// covered in mnemonics.test.ts, kana-family.test.ts and
// kana-entry-view.test.ts respectively; this file owns only yoon-rows.ts.

import assert from "node:assert/strict";
import test from "node:test";

import { CHAR_INDEX } from "@/data/characters";
import { YOON_ROWS, yoonRowFor } from "./yoon-rows.ts";

test("YOON_ROWS has 36 combos per script, 72 total — exactly the two-codepoint CHAR_INDEX entries", () => {
  const combos = Object.keys(CHAR_INDEX).filter((c) => Array.from(c).length === 2);
  assert.equal(combos.length, 72);
  assert.equal(YOON_ROWS.length, 72);
  const hiragana = YOON_ROWS.filter((r) => r.setId === "hiragana");
  const katakana = YOON_ROWS.filter((r) => r.setId === "katakana");
  assert.equal(hiragana.length, 36);
  assert.equal(katakana.length, 36);
});

const SAMPLES: { glyph: string; base: string; small: string; reading: string; setId: "hiragana" | "katakana" }[] = [
  { glyph: "きゃ", base: "き", small: "ゃ", reading: "kya", setId: "hiragana" },
  { glyph: "しゅ", base: "し", small: "ゅ", reading: "shu", setId: "hiragana" },
  { glyph: "ちょ", base: "ち", small: "ょ", reading: "cho", setId: "hiragana" },
  { glyph: "ぎゃ", base: "ぎ", small: "ゃ", reading: "gya", setId: "hiragana" },
  { glyph: "キャ", base: "キ", small: "ャ", reading: "kya", setId: "katakana" },
  { glyph: "シュ", base: "シ", small: "ュ", reading: "shu", setId: "katakana" },
  { glyph: "チョ", base: "チ", small: "ョ", reading: "cho", setId: "katakana" },
];

test("yoonRowFor splits a combo into its base/small and carries the entry's reading", () => {
  for (const { glyph, base, small, reading, setId } of SAMPLES) {
    const row = yoonRowFor(glyph);
    assert.ok(row, `expected a row for ${glyph}`);
    assert.equal(row.base, base, `${glyph}'s base`);
    assert.equal(row.small, small, `${glyph}'s small kana`);
    assert.equal(row.reading, reading, `${glyph}'s reading`);
    assert.equal(row.setId, setId, `${glyph}'s script`);
    assert.equal(`${row.base}${row.small}`, glyph, "base+small must reassemble the glyph");
  }
});

test("yoonRowFor is null for a base kana, a dakuten/handakuten kana, and an untaught string", () => {
  assert.equal(yoonRowFor("き"), null);
  assert.equal(yoonRowFor("が"), null);
  assert.equal(yoonRowFor("ぱ"), null);
  assert.equal(yoonRowFor("これ"), null);
  assert.equal(yoonRowFor(""), null);
  assert.equal(yoonRowFor("生"), null);
});

test("every row's reading is the entry's own first accepted romaji", () => {
  for (const row of YOON_ROWS) {
    const info = CHAR_INDEX[row.glyph];
    assert.ok(info, `${row.glyph} should be in CHAR_INDEX`);
    assert.equal(row.reading, info.r[0]);
  }
});

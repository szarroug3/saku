// Run: node --import ./src/lib/conjugate/test-hooks.mjs --test src/data/mnemonics.test.ts
//
// node:test + native TypeScript stripping. No framework, no new deps — same as
// ingest.test.ts. This file cannot import the .tsx component (the runner strips
// types, not JSX), and it doesn't need to: both call sites — the teach-me
// walkthrough and the Library entry page — render the card ONLY when
// `getMnemonic(glyph)` is non-null, so the gate IS `getMnemonic`, and that is a
// plain function this can drive directly.

import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import test from "node:test";

import { MNEMONICS, getMnemonic, type SoundLine } from "./mnemonics.ts";

const VOWELS = ["あ", "い", "う", "え", "お"];

// All 46 base hiragana — the full set this table now covers.
const ALL_HIRAGANA = [
  "あ", "い", "う", "え", "お",
  "か", "き", "く", "け", "こ",
  "さ", "し", "す", "せ", "そ",
  "た", "ち", "つ", "て", "と",
  "な", "に", "ぬ", "ね", "の",
  "は", "ひ", "ふ", "へ", "ほ",
  "ま", "み", "む", "め", "も",
  "や", "ゆ", "よ",
  "ら", "り", "る", "れ", "ろ",
  "わ", "を", "ん",
];


test("getMnemonic returns null for a glyph with no entry (hide-when-absent)", () => {
  // The hide-when-absent case the Library page and the teach flow render as
  // NOTHING. No base hiragana hits this any more (all 46 are authored), so the
  // stand-ins are katakana and kanji glyphs, which are valid keys with no row.
  assert.equal(getMnemonic("ア"), null); // katakana, none authored yet
  assert.equal(getMnemonic("生"), null); // a kanji glyph is a valid key with no row
  assert.equal(getMnemonic(""), null);
});

test("all 46 base hiragana resolve to an entry keyed by their own glyph", () => {
  for (const k of ALL_HIRAGANA) {
    const m = getMnemonic(k);
    assert.ok(m, `expected a mnemonic for ${k}`);
    assert.equal(m.glyph, k, `${k} entry should be keyed by its own glyph`);
    assert.ok(m.romaji.length > 0, `${k} should declare a romaji reading`);
    assert.ok(m.analogy.lead.length > 0 || m.analogy.tail.length > 0, `${k} analogy should have prose`);
    assert.ok(m.analogy.sound && m.analogy.sound.length > 0, `${k} analogy must accent a sound`);
    // The example points at a real code point in its own word.
    const chars = [...m.example.word];
    assert.ok(
      m.example.hitIndex >= 0 && m.example.hitIndex < chars.length,
      `${k} example hitIndex out of range`,
    );
    // And that code point is the kana this entry teaches.
    assert.equal(chars[m.example.hitIndex], k, `${k} example hitIndex should land on ${k}`);
  }
  assert.equal(Object.keys(MNEMONICS).length, 46, "exactly the 46 base hiragana are authored");
});

test("Library-entry / teach-flow gate: a hiragana resolves, a non-authored glyph does not", () => {
  // Exactly what app/library/[entry]/page.tsx and components/lesson/teach-me.tsx
  // branch on. A hiragana entry page mounts the MnemonicCard; a katakana or
  // kanji page (nothing authored) mounts nothing.
  assert.notEqual(getMnemonic("あ"), null);
  assert.notEqual(getMnemonic("か"), null);
  assert.equal(getMnemonic("ア"), null);
});

// EVERY kana now gets a CANDIDATE image path, derived from its own romaji. It's
// a candidate: whether the file exists is decided on disk, and the renderers
// fall back to the glyph when it 404s (MnemonicImage / KanaHero's onError). So
// there is nothing per-kana to maintain here — the path is a pure function of
// the romaji, and adding a drawing never touches this test.
test("every kana yields the /mnemonics/<romaji>.webp path derived from its romaji", () => {
  for (const k of ALL_HIRAGANA) {
    const m = getMnemonic(k);
    assert.ok(m);
    assert.equal(
      m.image,
      `/mnemonics/${m.romaji}.webp`,
      `${k} should expose the candidate path keyed by its romaji (${m.romaji})`,
    );
    // The romaji goes into the path VERBATIM — the Hepburn spelling (shi/chi/
    // tsu/fu/wo), which is the filename the owner must save. Guard the ones that
    // differ from a naive consonant+vowel guess so the two can't drift.
    assert.ok(m.image!.includes(`/${m.romaji}.webp`), `${k} path must use romaji verbatim`);
  }
  // The four irregular readings, pinned: filenames the owner saves as-is.
  assert.equal(getMnemonic("し")!.image, "/mnemonics/shi.webp");
  assert.equal(getMnemonic("ち")!.image, "/mnemonics/chi.webp");
  assert.equal(getMnemonic("つ")!.image, "/mnemonics/tsu.webp");
  assert.equal(getMnemonic("ふ")!.image, "/mnemonics/fu.webp");
  assert.equal(getMnemonic("を")!.image, "/mnemonics/wo.webp");
});

// The eight drawings that ship today must still be on disk under the exact
// romaji-keyed name getMnemonic derives — the guarantee that the migration
// didn't change which kana show a picture. Reads public/mnemonics directly:
// these files ARE the registry now.
test("the eight shipped drawings (a/e/i/ka/ku/sa/u/wa) resolve to files on disk", () => {
  const publicDir = fileURLToPath(new URL("../../public/mnemonics/", import.meta.url));
  for (const glyph of ["あ", "え", "い", "か", "く", "さ", "う", "わ"]) {
    const romaji = getMnemonic(glyph)!.romaji;
    assert.equal(getMnemonic(glyph)!.image, `/mnemonics/${romaji}.webp`);
    assert.ok(
      existsSync(`${publicDir}${romaji}.webp`),
      `${glyph}: public/mnemonics/${romaji}.webp should exist so the drawing shows`,
    );
  }
});

test("every vowel is approved (no draft flag); every た–ん entry is flagged draft", () => {
  for (const v of VOWELS) {
    assert.notEqual(getMnemonic(v)!.draft, true, `${v} is approved, not draft`);
  }
  // あ–そ (through そ) are approved; た onward are draft.
  const approvedThroughSo = ALL_HIRAGANA.slice(0, ALL_HIRAGANA.indexOf("そ") + 1);
  for (const k of approvedThroughSo) {
    assert.notEqual(getMnemonic(k)!.draft, true, `${k} (あ–そ) should not be draft`);
  }
  const draftFromTa = ALL_HIRAGANA.slice(ALL_HIRAGANA.indexOf("た"));
  for (const k of draftFromTa) {
    assert.equal(getMnemonic(k)!.draft, true, `${k} (た–ん) should be flagged draft`);
  }
});

// THE EMPHASIS RULE, encoded.
//
// A SoundLine has exactly one emphasis field — `sound` — and it is the span the
// accent colour paints. There is no "shape" emphasis to express: the type has
// no such field, so a shape word simply cannot be marked "correct." What is
// left to check on the DATA is that a non-null `sound` really carries the
// kana's sound — i.e. it contains the entry's own accented token — and never
// silently drifts to a shape word that happens to type-check.
test("every accented span carries the kana's sound, never a shape word", () => {
  for (const [glyph, m] of Object.entries(MNEMONICS)) {
    const token = m.sound.toLowerCase();
    assert.ok(token.length > 0, `${glyph} must declare its accented sound token`);

    const lines: Array<[string, SoundLine]> = [
      ["analogy", m.analogy],
      ["mnemonic", m.mnemonic],
    ];
    for (const [name, line] of lines) {
      // Structural: the only emphasis a line can carry is `sound`.
      assert.deepEqual(
        Object.keys(line).sort(),
        ["lead", "sound", "tail"],
        `${glyph} ${name} should be a plain SoundLine (lead/sound/tail only)`,
      );
      if (line.sound !== null) {
        assert.ok(
          line.sound.toLowerCase().includes(token),
          `${glyph} ${name} accents "${line.sound}", which does not carry the sound "${m.sound}" — accent the sound or accent nothing, never a shape word`,
        );
      }
    }

    // The analogy always has a sound to accent (an analogy with none isn't one).
    assert.notEqual(m.analogy.sound, null, `${glyph} analogy must accent its sound`);
  }
});

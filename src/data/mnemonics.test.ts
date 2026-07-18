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

import { MNEMONICS, getMnemonic, kanaScript, type SoundLine } from "./mnemonics.ts";

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
    assert.ok(m.analogy.length > 0, `${k} analogy should have prose`);
    assert.ok(m.analogy.some((s) => s.accent), `${k} analogy must accent a sound`);
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
test("every hiragana yields the /mnemonics/hiragana/<romaji>.webp path derived from its romaji", () => {
  for (const k of ALL_HIRAGANA) {
    const m = getMnemonic(k);
    assert.ok(m);
    assert.equal(
      m.image,
      `/mnemonics/hiragana/${m.romaji}.webp`,
      `${k} should expose the candidate path keyed by its script + romaji (${m.romaji})`,
    );
    // The romaji goes into the path VERBATIM — the Hepburn spelling (shi/chi/
    // tsu/fu/wo), which is the filename the owner must save. Guard the ones that
    // differ from a naive consonant+vowel guess so the two can't drift.
    assert.ok(m.image!.endsWith(`/${m.romaji}.webp`), `${k} path must use romaji verbatim`);
  }
  // The four irregular readings, pinned: filenames the owner saves as-is,
  // under the hiragana/ prefix.
  assert.equal(getMnemonic("し")!.image, "/mnemonics/hiragana/shi.webp");
  assert.equal(getMnemonic("ち")!.image, "/mnemonics/hiragana/chi.webp");
  assert.equal(getMnemonic("つ")!.image, "/mnemonics/hiragana/tsu.webp");
  assert.equal(getMnemonic("ふ")!.image, "/mnemonics/hiragana/fu.webp");
  assert.equal(getMnemonic("を")!.image, "/mnemonics/hiragana/wo.webp");
});

// The katakana branch: none are authored yet, so there's no MNEMONICS row to
// resolve. Guard the derivation directly — `kanaScript` classifies カ as
// katakana, and IF an entry existed its image path would carry the katakana/
// folder, keeping か (hiragana) and カ (katakana) from sharing one filename.
test("kanaScript classifies script by Unicode block, and katakana derives the katakana/ folder", () => {
  assert.equal(kanaScript("か"), "hiragana");
  assert.equal(kanaScript("カ"), "katakana");
  assert.equal(kanaScript("生"), null); // kanji — no script folder
  assert.equal(kanaScript(""), null);
  assert.equal(kanaScript("かa"), null); // multi-code-point, not a single glyph
  // No カ row is authored, so getMnemonic returns null today…
  assert.equal(getMnemonic("カ"), null);
  // …but the path a katakana entry WOULD derive is under katakana/, distinct
  // from the hiragana か path. This mirrors getMnemonic's derivation.
  const script = kanaScript("カ");
  assert.equal(`/mnemonics/${script}/ka.webp`, "/mnemonics/katakana/ka.webp");
  assert.notEqual(getMnemonic("か")!.image, `/mnemonics/${script}/ka.webp`);
});

// The eight drawings that ship today must still be on disk under the exact
// romaji-keyed name getMnemonic derives — the guarantee that the migration
// didn't change which kana show a picture. Reads public/mnemonics directly:
// these files ARE the registry now.
test("the eight shipped drawings (a/e/i/ka/ku/sa/u/wa) resolve to files on disk", () => {
  const hiraganaDir = fileURLToPath(new URL("../../public/mnemonics/hiragana/", import.meta.url));
  for (const glyph of ["あ", "え", "い", "か", "く", "さ", "う", "わ"]) {
    const romaji = getMnemonic(glyph)!.romaji;
    assert.equal(getMnemonic(glyph)!.image, `/mnemonics/hiragana/${romaji}.webp`);
    assert.ok(
      existsSync(`${hiraganaDir}${romaji}.webp`),
      `${glyph}: public/mnemonics/hiragana/${romaji}.webp should exist so the drawing shows`,
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
// A SoundLine is an ordered array of spans; `accent: true` paints a span in the
// accent colour, and the accent colour is reserved for the sound. There is no
// "shape" emphasis to express. What the DATA must hold:
//   • every line is a non-empty array of {text, accent?} spans, none empty;
//   • the analogy carries at least one accent span whose text contains the
//     entry's own sound token — the explicit phonetic cue is always present;
//   • the mnemonic MAY carry zero accent spans (a story naming only the shape).
// In-word accent spans need NOT contain the token literally: they carry the
// sound phonetically (the "a" in father is the sound without spelling "ah").
test("every line is a well-formed span array; the analogy always cues its sound", () => {
  for (const [glyph, m] of Object.entries(MNEMONICS)) {
    const token = m.sound.toLowerCase();
    assert.ok(token.length > 0, `${glyph} must declare its accented sound token`);

    const lines: Array<[string, SoundLine]> = [
      ["analogy", m.analogy],
      ["mnemonic", m.mnemonic],
    ];
    for (const [name, line] of lines) {
      assert.ok(Array.isArray(line) && line.length > 0, `${glyph} ${name} should be a non-empty span array`);
      for (const span of line) {
        assert.deepEqual(
          Object.keys(span).sort().filter((k) => k !== "accent"),
          ["text"],
          `${glyph} ${name} span should be a plain SoundSpan (text, optional accent)`,
        );
        assert.equal(typeof span.text, "string");
        assert.ok(span.text.length > 0, `${glyph} ${name} has an empty-text span`);
        if ("accent" in span) {
          assert.equal(typeof span.accent, "boolean", `${glyph} ${name} accent must be a boolean when present`);
        }
      }
    }

    // The analogy always cues the sound: at least one accent span whose text
    // carries the entry's own token (the explicit "say it like…" phonetic cue).
    assert.ok(
      m.analogy.some((s) => s.accent && s.text.toLowerCase().includes(token)),
      `${glyph} analogy must accent a span carrying the sound "${m.sound}"`,
    );
    // The mnemonic MAY accent nothing — a story that names only the shape.
  }
});

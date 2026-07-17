// Run: node --import ./src/lib/conjugate/test-hooks.mjs --test src/data/mnemonics.test.ts
//
// node:test + native TypeScript stripping. No framework, no new deps — same as
// ingest.test.ts. This file cannot import the .tsx component (the runner strips
// types, not JSX), and it doesn't need to: both call sites — the teach-me
// walkthrough and the Library entry page — render the card ONLY when
// `getMnemonic(glyph)` is non-null, so the gate IS `getMnemonic`, and that is a
// plain function this can drive directly.

import assert from "node:assert/strict";
import test from "node:test";

import { MNEMONICS, getMnemonic, type SoundLine } from "./mnemonics.ts";

const VOWELS = ["あ", "い", "う", "え", "お"];

test("getMnemonic returns null for a kana with no entry (hide-when-absent)", () => {
  // を and か are real kana with Library entries but no mnemonic — the case the
  // Library page and the teach flow must render as NOTHING. A null here is the
  // whole of that behaviour: the callers mount no section.
  assert.equal(getMnemonic("を"), null);
  assert.equal(getMnemonic("か"), null);
  assert.equal(getMnemonic("ア"), null); // katakana, none authored yet
  assert.equal(getMnemonic("生"), null); // a kanji glyph is a valid key with no row
});

test("Library-entry / teach-flow gate: a vowel resolves, a no-entry kana does not", () => {
  // Exactly what app/library/[entry]/page.tsx and components/lesson/teach-me.tsx
  // branch on. A vowel entry page mounts the MnemonicCard; a を entry page (or
  // any word/kanji page) mounts nothing.
  assert.notEqual(getMnemonic("あ"), null);
  assert.equal(getMnemonic("を"), null);
});

test("the five vowels resolve, each with a non-empty svg and analogy", () => {
  for (const v of VOWELS) {
    const m = getMnemonic(v);
    assert.ok(m, `expected a mnemonic for ${v}`);
    assert.equal(m.glyph, v);
    assert.ok(m.svg.trim().startsWith("<svg"), `${v} svg should be inline <svg> markup`);
    assert.ok(m.svg.includes("currentColor"), `${v} svg should draw with currentColor`);
    assert.ok(m.analogy.lead.length > 0, `${v} analogy should be non-empty`);
    assert.ok(m.analogy.sound && m.analogy.sound.length > 0, `${v} analogy must accent a sound`);
    // The example points at a real code point in its own word.
    const chars = [...m.example.word];
    assert.ok(
      m.example.hitIndex >= 0 && m.example.hitIndex < chars.length,
      `${v} example hitIndex out of range`,
    );
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

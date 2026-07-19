// Run: node --import ./src/lib/conjugate/test-hooks.mjs --test src/data/glyph-variants.test.ts
//
// node:test + native TypeScript stripping. No framework, no new deps — same as
// mnemonics.test.ts. The glyph-variant note is data, and the one invariant a
// data note has to keep is HONESTY: it may not point at a kana the app does not
// teach, and it must not read as jargon or use an em dash (the project's copy
// rule). This file drives glyphVariantFor directly, which is the same gate both
// call sites — the lesson card and the Library entry page — render on.

import assert from "node:assert/strict";
import test from "node:test";

import { CHAR_INDEX, glyphVariantFor } from "./characters.ts";

// The small, deliberate set. Kept here as the test's own expectation so that
// adding or dropping a note is a decision someone has to make in two places.
const ANNOTATED = ["き", "さ", "り", "そ", "ふ"];

test("every annotated kana is a real character the app teaches", () => {
  for (const c of ANNOTATED) {
    assert.ok(glyphVariantFor(c), `expected a glyph-variant note for ${c}`);
    assert.ok(CHAR_INDEX[c], `${c} must be a real kana in CHAR_INDEX`);
  }
});

test("exactly the intended kana are annotated, nothing snuck in", () => {
  const annotated = [...ANNOTATED];
  for (const c of Object.keys(CHAR_INDEX)) {
    if (glyphVariantFor(c)) {
      assert.ok(
        annotated.includes(c),
        `${c} has a glyph-variant note but is not in the intended set`,
      );
    }
  }
});

test("a regular kana and a non-kana glyph get no note (silence, not empty)", () => {
  assert.equal(glyphVariantFor("あ"), null); // regular hiragana
  assert.equal(glyphVariantFor("キ"), null); // katakana carries no split
  assert.equal(glyphVariantFor("生"), null); // a kanji glyph is not a kana
  assert.equal(glyphVariantFor(""), null);
});

test("notes are plain and follow the copy rules (no em dash, honest close)", () => {
  for (const c of ANNOTATED) {
    const note = glyphVariantFor(c)!;
    assert.ok(!note.includes("\u2014"), `${c} note must not use an em dash`);
    assert.ok(
      note.includes("same kana"),
      `${c} note should reassure that both forms are the same kana`,
    );
  }
});

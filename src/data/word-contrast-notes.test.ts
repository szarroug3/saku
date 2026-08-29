// Run: node --test src/data/word-contrast-notes.test.ts
//
// SAK-229: hand-authored word-nuance contrast notes. One shape so far —
// WORD_CONTRAST_PAIRS (いいえ/いや) — a shared note that must resolve from
// EITHER word's side, the same "resolves from either side" shape
// radical-tips.ts's RADICAL_CONFUSABLE_PAIRS uses for shape pairs.

import assert from "node:assert/strict";
import test, { describe } from "node:test";

import {
  WORD_CONTRAST_PAIRS,
  wordContrastNoteFor,
  wordContrastPartner,
} from "./word-contrast-notes.ts";

describe("wordContrastPartner", () => {
  test("resolves from EITHER side of the いいえ/いや pair, same note text", () => {
    const fromIie = wordContrastPartner("いいえ");
    const fromIya = wordContrastPartner("いや");
    assert.ok(fromIie, "いいえ should have a partner");
    assert.ok(fromIya, "いや should have a partner");
    assert.equal(fromIie!.glyph, "いや");
    assert.equal(fromIya!.glyph, "いいえ");
    assert.equal(fromIie!.note, fromIya!.note);
    // The note names both words, so it reads correctly from either page.
    assert.match(fromIie!.note, /いいえ/);
    assert.match(fromIie!.note, /いや/);
  });

  test("a word with no authored pair has no partner", () => {
    assert.equal(wordContrastPartner("人"), undefined);
    assert.equal(wordContrastPartner("先生"), undefined);
  });
});

describe("wordContrastNoteFor", () => {
  test("いいえ and いや resolve to the same note", () => {
    const a = wordContrastNoteFor("いいえ");
    const b = wordContrastNoteFor("いや");
    assert.ok(a);
    assert.equal(a, b);
  });

  test("a word with no authored note returns undefined", () => {
    assert.equal(wordContrastNoteFor("人"), undefined);
  });
});

test("every pair word and every note is non-empty", () => {
  for (const pair of WORD_CONTRAST_PAIRS) {
    assert.ok(pair.a.length > 0);
    assert.ok(pair.b.length > 0);
    assert.ok(pair.note.length > 0);
  }
});

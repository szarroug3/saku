// What a thing is called, wherever it is labeled (SAK-464). The Observatory's
// tile, the eyebrow on the lesson card and the Atlas entry, and the tooltip
// over a star all call `typeLabel`, so the rules it follows are held here
// rather than in each of the three.

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { typeLabel } from "./tokens";
import type { SkyItem } from "./types";

const item = (over: Partial<SkyItem>): SkyItem => ({ id: "x", kind: "word", glyph: "本", english: "book", standing: "not-seen", ...over });

describe("what a thing is called", () => {
  it("takes the item's own word when it has one", () => {
    assert.equal(typeLabel(item({ kind: "grammar", glyph: "〜は", english: "marks the topic", label: "particle" })), "particle");
  });

  it("calls a pattern with no word of its own a grammar pattern, not grammar", () => {
    assert.equal(typeLabel(item({ kind: "grammar", glyph: "〜ている", english: "is doing" })), "grammar pattern");
  });

  it("calls a shape of sentence a sentence type, one of them, not sentences", () => {
    assert.equal(typeLabel(item({ kind: "sentence", glyph: "Simple", english: "Simple" })), "sentence type");
  });

  it("says which script a kana is, since that is the choice a learner makes", () => {
    assert.equal(typeLabel(item({ kind: "kana", glyph: "か", english: "K row" })), "hiragana");
    assert.equal(typeLabel(item({ kind: "kana", glyph: "カ", english: "K row" })), "katakana");
  });

  it("is the kind's own word for everything else", () => {
    assert.equal(typeLabel(item({})), "word");
    assert.equal(typeLabel(item({ kind: "verbPair" })), "verb pair");
  });
});

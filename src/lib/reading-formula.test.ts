// Run: node --import ./src/lib/conjugate/test-hooks.mjs --test \
//        src/lib/reading-formula.test.ts
//
// The formula hint for a kanji-reading card (task #22). A reading is asked inside
// a known, multi-part word, and the hint lays that word out with every OTHER
// piece's reading filled in and the asked piece left blank — [病] + [院 / いん] =
// 病院 — so the answer (病 = びょう) is nudged toward, never handed over.

import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { readingFactId } from "../data/kanji.ts";
import { hintFor } from "./engine/hint.ts";
import { readingFormula } from "./reading-formula.ts";
import type { FactId } from "../types/index.ts";

describe("readingFormula — the pieces of the nudge", () => {
  test("病院 asking 病 → [病 (blank)] + [院 / いん] = 病院", () => {
    const f = readingFormula("病", "病院");
    assert.ok(f);
    assert.deepEqual(f.pieces, [{ text: "病" }, { text: "院", reading: "いん" }]);
    assert.equal(f.result, "病院");
  });

  test("the asked piece never carries its reading — the answer is not in the hint", () => {
    // Ask the OTHER kanji of the same word: now 病 carries its reading and 院 is
    // the blank. Whichever piece is asked is the one left empty.
    const f = readingFormula("院", "病院");
    assert.ok(f);
    assert.deepEqual(f.pieces, [{ text: "病", reading: "びょう" }, { text: "院" }]);
  });

  test("a kanji+kana word keeps the kana tail as its own phonetic piece", () => {
    // 病む: 病 is asked (blank), む is kana and already its own sound, so it shows
    // as itself with no reading line.
    const f = readingFormula("病", "病む");
    assert.ok(f);
    assert.deepEqual(f.pieces, [{ text: "病" }, { text: "む" }]);
    assert.equal(f.result, "病む");
  });

  test("a three-kanji word shows every OTHER piece with its reading", () => {
    const f = readingFormula("人", "外国人");
    assert.ok(f);
    assert.deepEqual(f.pieces, [
      { text: "外", reading: "がい" },
      { text: "国", reading: "こく" },
      { text: "人" },
    ]);
    assert.equal(f.result, "外国人");
  });

  test("a single-kanji word has nothing beside the kanji — no formula", () => {
    assert.equal(readingFormula("人", "人"), null);
  });

  test("a word that does not contain the asked kanji — no formula", () => {
    assert.equal(readingFormula("生", "病院"), null);
  });
});

describe("hintFor wires the formula onto the reading card", () => {
  const BYOU: FactId = readingFactId("病", "病院");

  test("a kanji reading card gets a formula hint framed on its word", () => {
    const hint = hintFor(BYOU, "jp2en", "病院");
    assert.ok(hint);
    assert.equal(hint.kind, "formula");
    assert.equal(hint.kind === "formula" && hint.formula.result, "病院");
  });

  test("it is non-null even with NO word passed — the button always shows", () => {
    // The regression Sam hit: the Hint button never appeared on a kanji-reading
    // card. The drill gates the button on hintFor being non-null, so this must
    // hold whether or not the caller passes the framing word — with none, it
    // falls back to the fact's own multi-part anchor and still builds a formula.
    const hint = hintFor(BYOU, "jp2en");
    assert.ok(hint, "hintFor must return a hint so the Hint button renders");
    assert.equal(hint.kind, "formula");
  });

  test("with no word to frame on, it declines rather than inventing one", () => {
    // Fed a single-kanji 'word', there is nothing beside the kanji to show, so
    // the on-its-own card gets no hint — the reading alone would be the answer.
    assert.equal(hintFor(BYOU, "jp2en", "病"), null);
  });
});

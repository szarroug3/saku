// Run: node --import ./src/lib/conjugate/test-hooks.mjs --test src/lib/import.test.ts
//
// import.ts reads a deck out of a pasted/exported file. Its promises: an import
// ADDS NO CONTENT (one field per line, the rest discarded), a repeated entry
// contributes once, and every failure is EXPLAINED with an honest reason —
// never silently rewritten. applySuggestion returns a NEW report, because the
// original is "what the file said" and must stay that.

import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { applySuggestion, readList } from "@/lib/import";

describe("readList — matching and de-duplication", () => {
  test("a real jōyō word matches to its word entry", () => {
    const r = readList("先生");
    assert.equal(r.matched.length, 1);
    assert.equal(r.rows[0].entry, "word:先生");
    assert.deepEqual(r.entries, ["word:先生"]);
  });

  test("a repeated word contributes ONE entry, but every row is kept", () => {
    const r = readList("先生\n先生\n学生");
    assert.equal(r.rows.length, 3, "every line is a row the user can recognise");
    assert.deepEqual(r.entries, ["word:先生", "word:学生"], "distinct, in file order");
  });

  test("Anki's leading # comment block is skipped", () => {
    const r = readList("#separator:tab\n#html:false\n先生");
    assert.equal(r.matched.length, 1);
    assert.equal(r.entries.length, 1);
  });

  test("only the first TSV/CSV field is read; quotes are stripped", () => {
    assert.equal(readList("先生\tthe teacher").rows[0].entry, "word:先生");
    assert.equal(readList("先生,a note").rows[0].entry, "word:先生");
    assert.equal(readList('"先生"\tx').rows[0].entry, "word:先生");
  });

  test("a romaji headword matches by its sound — a deck typed without an IME", () => {
    // "shito" is しと is 使徒, the same resolution the Library search makes; a
    // headword with no Japanese in it used to be dismissed as an English note.
    const shito = readList("shito");
    assert.equal(shito.rows[0].entry, "word:使徒", "shito → 使徒 by reading");
    assert.equal(shito.rows[0].why, null);
    assert.deepEqual(shito.entries, ["word:使徒"]);

    // A kana WORD is reached the same way — あなた's glyph is its reading.
    assert.equal(readList("anata").rows[0].entry, "word:あなた");
  });

  test("a real kana/kanji headword still matches directly, unchanged", () => {
    // The direct index is the primary path; romaji is only a fallback, so an
    // exact glyph resolves exactly as before.
    assert.equal(readList("先生").rows[0].entry, "word:先生");
    assert.equal(readList("しと").rows[0].entry, "word:使徒");
  });

  test("a keyboard mash is not romaji-for-a-sound, so it stays unmatched", () => {
    // "qwerty" does not convert cleanly to kana, so it fails the isKanaOnly gate
    // and lands in unmatched, an English note like any other.
    const row = readList("qwerty").rows[0];
    assert.equal(row.entry, null);
    assert.match(row.why ?? "", /English/);
  });
});

describe("readList — every failure is explained, none rewritten", () => {
  test("furigana stuck to the word is offered as a suggestion, not applied", () => {
    const row = readList("食べる[たべる]").rows[0];
    assert.equal(row.entry, null, "not silently matched — the file said something else");
    assert.deepEqual(row.suggest, { text: "食べる", entry: "word:食べる" });
    assert.match(row.why ?? "", /reading/i);
  });

  test("an English row is named as a note to self, with no suggestion", () => {
    const row = readList("hello").rows[0];
    assert.equal(row.entry, null);
    assert.equal(row.suggest, null);
    assert.match(row.why ?? "", /English/);
  });

  test("a whole sentence is called a sentence, not a missing word", () => {
    // Longer than the longest headword (8) and full of kanji.
    const row = readList("私は毎日日本語を勉強します").rows[0];
    assert.equal(row.entry, null);
    assert.match(row.why ?? "", /sentence/i);
  });

  test("an unmatched kana-only word is explained as out of scope, not 'not in the dictionary'", () => {
    // A kana string the dictionary does not carry — real kana words like これ DO
    // match via their reading, so this hits the kana-only branch specifically.
    const row = readList("ぷぷぷ").rows[0];
    assert.equal(row.entry, null);
    assert.match(row.why ?? "", /kana/i);
  });

  test("an empty field is 'nothing in the field'", () => {
    const row = readList("\t\tonly notes").rows[0];
    assert.equal(row.entry, null);
    assert.match(row.why ?? "", /Nothing/i);
  });
});

describe("applySuggestion — a new report, the original untouched", () => {
  test("applying the furigana repair matches the row and adds its entry", () => {
    const before = readList("食べる[たべる]\n先生");
    assert.equal(before.matched.length, 1, "only 先生 matched to start");

    const after = applySuggestion(before, "食べる[たべる]");

    assert.equal(after.matched.length, 2, "the repaired row now matches too");
    assert.ok(after.entries.map(String).includes("word:食べる"));
    // The original report is what the file said — it must NOT have changed.
    assert.equal(before.matched.length, 1, "original report untouched");
    assert.equal(before.rows[0].entry, null, "original row still unmatched");
    assert.notEqual(after, before, "a new object");
  });

  test("a raw with no suggestion is a no-op on the rows", () => {
    const before = readList("hello");
    const after = applySuggestion(before, "hello");
    assert.equal(after.rows[0].entry, null);
    assert.deepEqual(after.entries, []);
  });
});

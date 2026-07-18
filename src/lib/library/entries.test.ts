// Run: node --test src/lib/library/entries.test.ts
//
// The entry page's facts table, as data. The table is GENERIC ACROSS KINDS —
// one component renders a kanji's readings, a word's reading-and-meaning and a
// grammar pattern's meaning-and-form — and the two ways that goes wrong are
// both invisible from any single page:
//
//  - A HEADED SECTION WITH NO ROWS. The kanji meaning row used to guarantee
//    every kanji at least one row. It is gone, so 114 jōyō kanji with no
//    everyday-word-attested reading now produce none, and a grammar pattern
//    with no recipe never did. The page must render nothing there, not an empty
//    box; this file asserts the emptiness so the page's guard has something to
//    guard against.
//  - A TITLE THAT DESCRIBES A DIFFERENT TABLE. "Readings" over a pattern's
//    meaning row is the same class of lie the old "Reading" column told about
//    the meaning row it sat above.

import assert from "node:assert/strict";
import test from "node:test";

import { KANJI } from "@/data/kanji";
import {
  factRows,
  factsColumnHeader,
  factsTitle,
  libEntry,
  type LibEntry,
} from "./entries.ts";
import { kanjiEntry } from "@/data/kanji";
import { kanaEntry } from "@/data/characters";
import { wordEntry } from "@/data/vocab";

const need = (e: LibEntry | undefined): LibEntry => {
  assert.ok(e);
  return e;
};

test("a kanji's table is readings only — the meaning row is gone", () => {
  // 一 is the case the owner reported: its first row was the MEANING, under a
  // column headed "Reading", and the meaning KANJIDIC2 gave was "one, one
  // radical (no.1)". Every row here is now a reading.
  const one = need(libEntry(kanjiEntry("一")));
  const rows = factRows(one);
  assert.ok(rows.length > 0);
  assert.ok(
    rows.every((r) => r.label !== "Meaning"),
    "a meaning row survived in the kanji table",
  );
  assert.ok(rows.some((r) => r.label === "いち"));
  assert.equal(factsColumnHeader(one), "Reading");
  assert.equal(factsTitle(one, rows), "Readings");
});

test("each reading says where its sound came from, in words a beginner knows", () => {
  const rows = factRows(need(libEntry(kanjiEntry("一"))));
  const by = new Map(rows.map((r) => [r.label, r]));
  // The jargon is on'yomi and kun'yomi. It is never what ships.
  assert.equal(by.get("いち")?.origin, "from Chinese");
  assert.equal(by.get("ひと")?.origin, "native Japanese");
  for (const r of rows) {
    assert.ok(!/yomi/i.test(r.origin ?? ""), `jargon leaked: ${r.origin}`);
  }
});

test("only rows that are Japanese sound get a speaker", () => {
  // A reading and a kana are speakable. A meaning is English and a pattern is a
  // shape, not a sound — the page omits its Hear-it button for grammar for the
  // same reason.
  const kanji = factRows(need(libEntry(kanjiEntry("一"))));
  assert.ok(kanji.every((r) => r.speak === r.label));

  const kana = factRows(need(libEntry(kanaEntry("し"))));
  assert.equal(kana[0]?.speak, "し");

  const word = factRows(need(libEntry(wordEntry("先生"))));
  // The word row speaks its READING. A synthesiser handed 先生 has to guess.
  assert.equal(word.find((r) => r.label === "Reading")?.speak, "せんせい");
  assert.equal(word.find((r) => r.label === "Meaning")?.speak, null);
});

test("a word keeps both its rows — dropping one would not leave a table", () => {
  const w = need(libEntry(wordEntry("先生")));
  const rows = factRows(w);
  assert.deepEqual(rows.map((r) => r.label), ["Reading", "Meaning"]);
  assert.equal(factsTitle(w, rows), "Reading and meaning");
  assert.equal(factsColumnHeader(w), "What it asks");
});

test("no kind renders a headed table with no rows", () => {
  // Every entry either has rows, or has none and the page renders nothing.
  // The assertion that matters is the second half being REAL: if this count
  // ever hits zero the page's guard is dead code and will rot.
  const empty = KANJI.filter((k) => factRows(need(libEntry(kanjiEntry(k.c)))).length === 0);
  assert.ok(empty.length > 0, "expected some kanji with no attested reading");
  assert.ok(
    empty.length < KANJI.length / 4,
    `${empty.length} kanji have no readings at all — the join broke`,
  );
  // And their meaning is still a scored fact, still shown, just not in a table:
  // it is the chip beside the definition. Losing it is the regression this
  // guards.
  const first = need(libEntry(kanjiEntry(empty[0]!.c)));
  assert.ok(first.meanings.length > 0);
});

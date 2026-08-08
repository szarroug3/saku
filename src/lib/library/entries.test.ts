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
  builtFrom,
  factRows,
  factsColumnHeader,
  factsTitle,
  libEntry,
  subjectLabel,
  type LibEntry,
} from "./entries.ts";
import { kanjiEntry } from "@/data/kanji";
import { kanaEntry } from "@/data/characters";
import { wordEntry } from "@/data/vocab";
import { factInfo } from "@/lib/facts.ts";
import { kanaFact } from "@/data/characters";
import { meaningFactId } from "@/data/kanji";
import { wordMeaningFactId } from "@/data/vocab";

const need = (e: LibEntry | undefined): LibEntry => {
  assert.ok(e);
  return e;
};

// ---- builtFrom: the kanji page's "Built from" shape decomposition ----

const built = (glyph: string) => builtFrom(need(libEntry(kanjiEntry(glyph))));

test("builtFrom keeps radical pieces — 何 is 亻 + 可, each linked with a meaning", () => {
  // The whole point of feeding this from madeOf rather than the kanji-only
  // teachableParts: 亻 is a bound form with no card, but it is half of 何 and a
  // learner needs it. It links through to the character it stands for (人).
  const p = built("何");
  assert.deepEqual(p.map((x) => x.c), ["亻", "可"]);
  assert.ok(p.every((x) => x.id !== null), "every piece of 何 should link");
  assert.equal(p[0]!.meaning, "person"); // 亻 → 人
  assert.ok(p[1]!.meaning.length > 0, "可 should carry a meaning");
});

test("a variant piece carries its note — 何's 亻 says it is 人 in its left form", () => {
  // Surface #2: the variant piece 亻 carries the character it stands for and where
  // it sits, so the "Built from" tile can say 亻 is 人 in its left form. The plain
  // piece 可 carries none.
  const p = built("何");
  const person = p[0]!;
  assert.equal(person.c, "亻");
  assert.ok(person.variant, "亻 should carry a variant note");
  assert.equal(person.variant!.original, "人");
  assert.equal(person.variant!.position, "left");
  assert.equal(person.variant!.name, "にんべん");
  assert.equal(p[1]!.variant, undefined, "the plain piece 可 carries no variant note");
});

test("builtFrom on 明 is 日 + 月, two taught kanji", () => {
  const p = built("明");
  assert.deepEqual(p.map((x) => x.c), ["日", "月"]);
  assert.ok(p.every((x) => x.id !== null));
});

test("builtFrom applies the #32 frame-dedup — 可 is 丁 + 口, not 丁 + 口 + 丁", () => {
  // madeOf reads the raw KanjiVG comps (丁,口,丁); deframe collapses the single
  // enclosure written twice.
  const p = built("可");
  assert.deepEqual(p.map((x) => x.c), ["丁", "口"]);
  assert.equal(p[0]!.meaning, "street"); // 丁
  assert.equal(p[1]!.meaning, "mouth"); // 口
});

test("builtFrom keeps a genuine repetition — 品 stays 口 + 口 + 口", () => {
  assert.deepEqual(built("品").map((x) => x.c), ["口", "口", "口"]);
});

test("builtFrom is empty for an atomic kanji — no section", () => {
  // 一 has no components; the page renders nothing rather than an empty card.
  assert.deepEqual(built("一"), []);
});

test("builtFrom is empty for every number kanji — memorised wholes, no pieces", () => {
  // 四…十 DO have KanjiVG comps (四 → 囗 儿, 六 → 亠 八), but those pieces are
  // shape-only and mislead, so the number kanji are taught whole and show no
  // "Built from" (src/data/number-kanji.ts). Contrast the counter kanji below.
  for (const n of ["一", "二", "三", "四", "五", "六", "七", "八", "九", "十"]) {
    assert.deepEqual(built(n), [], `${n} shows no Built from`);
  }
  // A counter kanji is NOT a number kanji: 回 still decomposes into 囗 + 口.
  assert.deepEqual(built("回").map((x) => x.c), ["囗", "口"]);
});

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

test("the subject pip splits kana by script and singularises words", () => {
  // Kana is the whole point of the split: the same "Kana" shelf reads
  // "Hiragana" or "Katakana" in the header, decided by the character itself.
  assert.equal(subjectLabel(factInfo(kanaFact("し"))), "Hiragana");
  assert.equal(subjectLabel(factInfo(kanaFact("シ"))), "Katakana");
  // A lesson teaches ONE word, so the "Words" shelf reads "Word" here.
  assert.equal(subjectLabel(factInfo(wordMeaningFactId("先生"))), "Word");
  // Kanji already reads right as a shelf label.
  assert.equal(subjectLabel(factInfo(meaningFactId("一"))), "Kanji");
  // A fact the data no longer has has no label rather than throwing.
  assert.equal(subjectLabel(undefined), undefined);
});

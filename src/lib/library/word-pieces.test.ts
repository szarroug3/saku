import assert from "node:assert/strict";
import { test } from "node:test";

import { VOCAB, vocabRow } from "@/data/vocab";
import { compoundNote, piecesOf } from "@/lib/library/word-pieces";

function pieces(keb: string) {
  const row = vocabRow(keb);
  assert.ok(row, `${keb} missing from vocab.json`);
  return piecesOf(row);
}

test("先生 splits into two linked kanji, each with its own sound", () => {
  const p = pieces("先生");
  assert.ok(p);
  assert.equal(p.length, 2);
  assert.deepEqual(
    p.map((x) => (x.kind === "kanji" ? [x.char, x.reading] : x.text)),
    [
      ["先", "せん"],
      ["生", "せい"],
    ],
  );
  assert.ok(p.every((x) => x.kind === "kanji" && x.entry));
});

test("生きる is one kanji plus an okurigana tail", () => {
  const p = pieces("生きる");
  assert.ok(p);
  assert.equal(p.length, 2);
  assert.equal(p[0].kind, "kanji");
  assert.deepEqual(p[1], { kind: "kana", text: "きる", okurigana: true });
});

test("生まれる is the SAME kanji with a different tail and a different sound", () => {
  // The pair that makes the okurigana worth naming at all.
  const p = pieces("生まれる");
  assert.ok(p);
  assert.equal(p[0].kind === "kanji" && p[0].reading, "う");
  assert.equal(p[1].kind === "kana" && p[1].text, "まれる");
});

test("a leading polite お is kana but NOT okurigana", () => {
  const p = pieces("お客様");
  assert.ok(p);
  assert.deepEqual(p[0], { kind: "kana", text: "お", okurigana: false });
});

test("medial っ is not okurigana either", () => {
  const p = pieces("引っ越す");
  assert.ok(p);
  const medial = p.find((x) => x.kind === "kana" && x.text === "っ");
  assert.ok(medial);
  assert.equal(medial.kind === "kana" && medial.okurigana, false);
  // and the trailing one IS
  const last = p[p.length - 1];
  assert.equal(last.kind === "kana" && last.okurigana, true);
});

test("々 repeats the kanji before it rather than failing to align", () => {
  const p = pieces("人々");
  assert.ok(p, "人々 must split — 々 occupies a kanji slot");
  assert.equal(p.length, 2);
  assert.equal(p[0].kind === "kanji" && p[0].written, "人");
  assert.equal(p[1].kind === "kanji" && p[1].written, "々");
  assert.equal(p[1].kind === "kanji" && p[1].char, "人");
  assert.equal(p[1].kind === "kanji" && p[1].reading, "びと");
});

test("a jukujikun word refuses to split", () => {
  // 大人 is おとな as a whole; there is no per-kanji reading to show.
  const row = vocabRow("大人");
  assert.ok(row);
  assert.equal(row.align, null);
  assert.equal(piecesOf(row), null);
});

test("every word in the vocabulary either splits or is honestly null", () => {
  // The coverage claim the page rests on. A THROW or a mis-split would be the
  // failure; null is a legitimate answer.
  let split = 0;
  let refused = 0;
  for (const w of VOCAB) {
    const p = piecesOf(w);
    if (p === null) {
      refused++;
      continue;
    }
    split++;
    // A split must reconstruct the written word exactly. This is what catches an
    // off-by-one in the align walk, which would otherwise print a plausible and
    // wrong reading.
    const rebuilt = p.map((x) => (x.kind === "kanji" ? x.written : x.text)).join("");
    assert.equal(rebuilt, w.keb, `split of ${w.keb} rebuilt as ${rebuilt}`);
  }
  assert.ok(split > 10_000, `only ${split} words split`);
  assert.ok(refused < 2_600, `${refused} words refused — expected the ~2.5k kana/jukujikun`);
});

test("先生 gets the compound note; both readings are Chinese", () => {
  const p = pieces("先生");
  assert.ok(p);
  const note = compoundNote(p);
  assert.ok(note);
  assert.match(note, /Both kanji use their Chinese reading/);
});

test("誕生日 resolves — the sound shift is in the surface, not the base", () => {
  // 生 says じょう here, which readings.json does not list; it lists しょう, and
  // that is what `align`'s third column carries. Keying on the base is what
  // takes this word from unresolvable to resolved.
  const p = pieces("誕生日");
  assert.ok(p);
  const sei = p.find((x) => x.kind === "kanji" && x.char === "生");
  assert.ok(sei && sei.kind === "kanji");
  assert.equal(sei.reading, "じょう");
  assert.equal(sei.base, "しょう");
  assert.ok(compoundNote(p), "誕生日 must get a note");
});

test("a one-kanji word gets no compound note", () => {
  const p = pieces("生きる");
  assert.ok(p);
  assert.equal(compoundNote(p), null);
});

test("the note is silent rather than guessing, and rarely", () => {
  let noted = 0;
  let silent = 0;
  for (const w of VOCAB) {
    const p = piecesOf(w);
    if (!p || p.filter((x) => x.kind === "kanji").length < 2) continue;
    if (compoundNote(p)) noted++;
    else silent++;
  }
  // Measured: 7,550 of 7,758 multi-kanji words are decisive; the 208 silent ones
  // are pieces KANJIDIC2 files under both types.
  assert.ok(noted > 7_000, `only ${noted} compounds noted`);
  assert.ok(silent < 400, `${silent} compounds silent — the ambiguous set should be ~208`);
});

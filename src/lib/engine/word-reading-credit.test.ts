// wordReadingCredit — grading + credit redirect on a TYPED word READING card.
//
// THE PROBLEM: two of a word's readings can share a meaning, so a reading card
// (kanji + definition → produce the reading) has more than one right answer and
// the kanji cannot disambiguate. 年+"year" is both とし and ねん. So the grader
// must accept EITHER reading and credit the unit whose reading was actually
// typed — while a reading that means something ELSE (じょう "standpoint" on the
// 上 "above" card) stays a miss on the intended unit.
//
//   node --import ./src/lib/conjugate/test-hooks.mjs --test src/lib/engine/word-reading-credit.test.ts

import test from "node:test";
import assert from "node:assert/strict";

import { wordReadingCredit } from "@/lib/engine/question";
import { checkTyped } from "@/lib/engine/index";
import { wordUnitFacts } from "@/data/vocab";

/** The reading fact of the unit whose reb is `reb`, from real data. */
function readingFactFor(keb: string, reb: string) {
  const wf = wordUnitFacts(keb).find((u) => u.unit.reb === reb);
  assert.ok(wf?.reading, `no reading fact for ${keb} ${reb}`);
  return wf!.reading!;
}

// ---- 年: two readings とし / ねん, both "year" → overlap, both valid ----

test("年 reading card: typing とし credits the とし unit", () => {
  const toshi = readingFactFor("年", "とし"); // primary, word:年/reading
  // The card is the primary (とし) reading fact.
  assert.deepEqual(wordReadingCredit(toshi, "とし"), { fact: toshi, ok: true });
});

test("年 reading card (intended とし): typing ねん is CORRECT and credits the ねん unit", () => {
  const toshi = readingFactFor("年", "とし");
  const nen = readingFactFor("年", "ねん"); // word:年/reading@ねん
  // Both spell it in kana AND in romaji ("nen") — the owner has no IME.
  assert.deepEqual(wordReadingCredit(toshi, "ねん"), { fact: nen, ok: true });
  assert.deepEqual(wordReadingCredit(toshi, "nen"), { fact: nen, ok: true });
});

test("年 reading card: garbage is a MISS credited to the intended unit", () => {
  const toshi = readingFactFor("年", "とし");
  assert.deepEqual(wordReadingCredit(toshi, "xyzzy"), { fact: toshi, ok: false });
  // Symmetry: on the ねん card, typing とし is also correct and redirects.
  const nen = readingFactFor("年", "ねん");
  assert.deepEqual(wordReadingCredit(nen, "とし"), { fact: toshi, ok: true });
});

// ---- unambiguous: single reading (先生) and non-overlapping multi (人) ----
// The helper must return the SAME ok as today's checkTyped, crediting intended.

test("先生 (single reading): equivalent to checkTyped, credits intended", () => {
  const sensei = readingFactFor("先生", "せんせい");
  for (const given of ["せんせい", "sensei", "wrong", "せんぱい"]) {
    const got = wordReadingCredit(sensei, given);
    assert.equal(
      got.ok,
      checkTyped(sensei, given, "jp2en"),
      `ok mismatch for "${given}"`,
    );
    // Credit never leaves the intended unit for a single-reading word.
    assert.equal(got.fact, sensei, `credit moved for "${given}"`);
  }
});

test("人 (ひと/じん/にん, no shared gloss): each reading credits ONLY its own unit", () => {
  const hito = readingFactFor("人", "ひと"); // person
  const jin = readingFactFor("人", "じん"); // -ian
  const nin = readingFactFor("人", "にん"); // counter for people
  // On the ひと ("person") card, ひと is right; じん/にん mean something else → miss.
  assert.deepEqual(wordReadingCredit(hito, "ひと"), { fact: hito, ok: true });
  assert.deepEqual(wordReadingCredit(hito, "じん"), { fact: hito, ok: false });
  assert.deepEqual(wordReadingCredit(hito, "にん"), { fact: hito, ok: false });
  // And equivalence with checkTyped for the valid answer on each card.
  for (const [f, reb] of [[hito, "ひと"], [jin, "じん"], [nin, "にん"]] as const) {
    assert.equal(wordReadingCredit(f, reb).ok, checkTyped(f, reb, "jp2en"));
  }
});

// ---- non-overlapping sibling: 上 うえ["above"] vs じょう["standpoint"] ----

test("上 reading card (うえ='above'): typing じょう is a MISS on the intended unit", () => {
  const ue = readingFactFor("上", "うえ"); // above / over / up
  const jou = readingFactFor("上", "じょう"); // from the standpoint of...
  // じょう is a REAL reading of 上, but its meaning does not overlap "above",
  // so on the うえ card it is wrong — and the miss is credited to うえ, NOT じょう.
  const got = wordReadingCredit(ue, "じょう");
  assert.deepEqual(got, { fact: ue, ok: false });
  assert.notEqual(got.fact, jou);
  // The intended reading is of course still correct.
  assert.deepEqual(wordReadingCredit(ue, "うえ"), { fact: ue, ok: true });
});

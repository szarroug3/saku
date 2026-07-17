// Run: node --test src/data/ingest.test.ts
//
// Uses node:test + native TypeScript stripping (Node 24). No test framework, no
// new dependencies.
//
// WHY THIS FILE EXISTS
// ====================
// The generated data is 2.7MB of JSON nobody will read, wired into a registry
// that resolves ids by lookup and therefore cannot tell you when a lookup was
// never going to succeed. Two classes of failure are silent here:
//
//  - A DUPLICATE FACT ID. `BY_FACT` is a Map, so a collision does not throw —
//    the second row wins and the first fact quietly stops existing. With 21,449
//    facts minted from data, a collision is a data question, not a code
//    question, so it has to be asked of the data.
//  - A HAND-AUTHORED TYPO. src/data/confusable.ts is the one table a human
//    edits. A character that is not in the kanji data produces a distractor
//    that renders as a box, and nothing else complains.
//
// The ordering assertions live in scripts/ingest/build.py instead, because they
// are properties of the GENERATOR — they must fail when the ingest is re-cut,
// which is the moment they can regress, not when the app boots.

import assert from "node:assert/strict";
import test from "node:test";

import { LOOKALIKE_KANJI, DERIVED_CONFUSABLE, distractorsFor } from "./confusable.ts";
import { KANJI, KANJI_FACTS, KANJI_ORDER, PREREQUISITE_ONLY, READINGS, kanjiRow } from "./kanji.ts";
import {
  VOCAB,
  VOCAB_FACTS,
  isKanaWord,
  vocabRow,
  wordMeaningFactId,
  wordReadingFactId,
} from "./vocab.ts";

test("jōyō is 2,136 kanji and has no grade 7", () => {
  assert.equal(KANJI.length, 2136);
  const grades = new Set(KANJI.map((k) => k.grade));
  assert.deepEqual([...grades].sort((a, b) => a - b), [1, 2, 3, 4, 5, 6, 8]);
});

test("every fact id is unique across every subject", () => {
  // The registry is a Map. A collision does not throw; it deletes a fact.
  const ids = [...KANJI_FACTS, ...VOCAB_FACTS].map((f) => f.id);
  assert.equal(new Set(ids).size, ids.length);
});

test("no fact is ungradable: every fact has at least one answer", () => {
  for (const f of [...KANJI_FACTS, ...VOCAB_FACTS]) {
    assert.ok(f.answers.length > 0, `${f.id} has no answer and cannot be graded`);
  }
});

test("a kanji reading fact is keyed on (kanji, word), never on the kanji alone", () => {
  // 生 has eight readings. If any of them minted a bare `kanji:生/reading` the
  // ids would collide and seven would vanish — which is precisely the bug the
  // entry/fact split exists to make impossible.
  //
  // Eight, not nine: 生's な came only from 生る, which JMdict marks `uk`. A
  // `uk` word is shipped as its kana form (なる) and contributes no kanji
  // evidence, because anchoring 生=な at a spelling nobody writes teaches a
  // word the learner will never see. Same rule as the jukujikun case below.
  const sei = READINGS.filter((r) => r.k === "生");
  assert.equal(sei.length, 8);
  const ids = new Set(sei.map((r) => `${r.k}@${r.anchor}`));
  assert.equal(ids.size, 8);
});

test("rendaku folds into the base reading rather than splitting the score", () => {
  // 口 is くち and こう — two readings, not three. 出口's ぐち is くち voiced,
  // and scoring it as a separate reading would split one piece of knowledge.
  const kuchi = READINGS.filter((r) => r.k === "口");
  assert.deepEqual(kuchi.map((r) => r.base).sort(), ["くち", "こう"]);
});

test("jukujikun contribute no per-kanji reading rather than a made-up one", () => {
  // 大人 is おとな. There is no reading of 大 in it. The word keeps its own
  // facts; it must not have produced kanji evidence.
  const otona = VOCAB.find((w) => w.keb === "大人");
  if (otona) assert.equal(otona.align, null);
  for (const r of READINGS) {
    assert.ok(!r.words.includes("大人"), `大人 fabricated evidence for ${r.k}`);
  }
});

// ---------------------------------------------------------------------------
// SCOPE REGRESSIONS. A missing word is the invisible failure this whole file
// exists for: it looks exactly like a word you have not reached yet. Nothing
// throws, no id collides, the app just quietly cannot teach 日本. Each of the
// words below was ACTUALLY missing, and each names the mechanism that dropped
// it, so a re-cut that reintroduces the mechanism fails here by name.
// ---------------------------------------------------------------------------

test("日本 is in the vocabulary: `spec1` is a source, not a lesser `ichi1`", () => {
  // 日本 is spec1 + news2/nf25 and carries NO ichi1. A filter on `ichi1` alone
  // drops the word for "Japan" out of a Japanese quiz — and the comment
  // defending that filter cited 日本 as a word it kept.
  const nihon = vocabRow("日本");
  assert.ok(nihon, "日本 is missing: the curated union has collapsed back to ichi1");
  assert.equal(nihon.reb, "にほん");
});

test("kana words are in the vocabulary: priority can live on the reading", () => {
  // These carry their `ichi1` on the r_ele, not the k_ele. An ingest that
  // reads only `ke_pri` never sees them AT ALL — they are not filtered out,
  // they are never loaded. これ has eight kanji spellings (此れ, 是, 之 …) and
  // not one is tagged, because nobody writes them.
  for (const [keb, reb] of [
    ["これ", "これ"],   // uk: kanji headwords exist, all untagged and non-jōyō
    ["とても", "とても"], // uk: 迚も is the headword nobody writes
    ["もう", "もう"],   // no k_ele at all — reading is the only headword
  ] as const) {
    const w = vocabRow(keb);
    assert.ok(w, `${keb} is missing: the ingest is reading ke_pri only again`);
    assert.equal(w.reb, reb);
    assert.ok(w.glosses.length > 0, `${keb} has no gloss and cannot be graded`);
  }
});

test("a kana word asks its meaning and never its reading", () => {
  // "What is これ read as?" prints its own answer. Emitting it would be an
  // ungradable question, so これ carries a meaning fact and no reading fact.
  const kore = vocabRow("これ");
  assert.ok(kore && isKanaWord(kore));
  const ids = new Set(VOCAB_FACTS.map((f) => f.id));
  assert.ok(ids.has(wordMeaningFactId("これ")), "これ lost its meaning fact");
  assert.ok(!ids.has(wordReadingFactId("これ")), "これ minted a self-answering reading fact");
  // 先生 is a kanji word and must still carry both.
  assert.ok(ids.has(wordReadingFactId("先生")));
  assert.ok(ids.has(wordMeaningFactId("先生")));
});

test("a kana word contributes no kanji evidence", () => {
  // これ has no kanji, so it must not claim a reading for one — the same rule
  // as the jukujikun case above, reached by a different route.
  for (const w of VOCAB) {
    if (isKanaWord(w)) assert.equal(w.align, null, `${w.keb} aligned kana to kanji`);
  }
});

test("hand-authored lookalikes are all real jōyō kanji", () => {
  // The one table a human edits, and a typo here renders as a box.
  for (const group of LOOKALIKE_KANJI) {
    assert.ok(group.length >= 2, `group ${group.join("")} needs two members`);
    for (const c of group) {
      assert.ok(kanjiRow(c), `${c} in LOOKALIKE_KANJI is not a jōyō kanji`);
    }
  }
});

test("KRADFILE cannot derive the classic pairs, which is why the table exists", () => {
  // Guards the claim src/data/confusable.ts is built on. If a future KRADFILE
  // re-cut ever DOES derive these, the hand-authored rows become duplicates and
  // this should fail so someone re-reads that file's reasoning.
  const derived = DERIVED_CONFUSABLE.map((g) => [...g].sort().join(""));
  for (const pair of [["人", "入"], ["土", "士"], ["未", "末"]]) {
    assert.ok(
      !derived.includes([...pair].sort().join("")),
      `KRADFILE now derives ${pair.join("/")}; confusable.ts is out of date`,
    );
  }
  // ...and it must still be predicted, by the hand-authored half.
  assert.ok(distractorsFor("人", 4).includes("入"));
  assert.ok(distractorsFor("未", 4).includes("末"));
});

test("'pulled in as a prerequisite' does not mean 'not a lesson'", () => {
  // 100 items enter via closure and 94 are ordinary lessons. Only the ones with
  // no everyday word at all are parts. Collapsing these two ideas would tell a
  // user that 口 — 37 everyday words — is not a lesson.
  //
  // Six, not nine: the curated union gave three of the old nine a real word
  // (乙 now has 甲乙), so they are lessons now. The 100 is NOT affected and
  // must not be — it comes from the frozen order input. See build.py's
  // vc_order/vc note: `enteredVia` is order, `everydayWords` is the shipped
  // vocab, and only the second one is allowed to move.
  const prereq = KANJI_ORDER.filter((o) => o.enteredVia === "prereq");
  assert.equal(prereq.length, 100);
  assert.equal(PREREQUISITE_ONLY.length, 6);
  assert.ok(PREREQUISITE_ONLY.includes("又"), "又's only word 又は is uk — it is a part");
  assert.ok(!PREREQUISITE_ONLY.includes("乙"), "乙 has 甲乙 and is a lesson");
  for (const c of ["口", "目", "子", "白"]) {
    assert.ok(!PREREQUISITE_ONLY.includes(c), `${c} is a real lesson`);
  }
});

// ---------------------------------------------------------------------------
// beginnerRank — the words-track ordering (scripts/ingest/beginnerrank.py). It
// is a build-time join like the frequency bands, and the properties that make
// it usable — total, unique, everyday-first — are properties of the GENERATOR,
// but a re-cut writes them into vocab.json, so they are also assertable here
// against the shipped data.
// ---------------------------------------------------------------------------

test("beginnerRank is total: every word has one, and they are 1..N with no gaps", () => {
  // The Words Track sorts by this field; a missing or duplicated rank is a hole
  // or a tie it cannot resolve. Must be a dense permutation of 1..12,553.
  const ranks = VOCAB.map((w) => w.beginnerRank);
  for (const w of VOCAB) {
    assert.equal(typeof w.beginnerRank, "number", `${w.keb} has no beginnerRank`);
  }
  assert.equal(new Set(ranks).size, ranks.length, "beginnerRank has a duplicate");
  assert.equal(Math.min(...ranks), 1);
  assert.equal(Math.max(...ranks), VOCAB.length);
});

test("beginnerRank puts everyday words ahead of newspaper words", () => {
  // The whole point of the field over newspaperBand: 食べる (to eat) is a first-
  // week word; 委員会 (committee) is a newspaper word a beginner never needs
  // early. The ordering must reflect that, not the reverse.
  const taberu = vocabRow("食べる");
  const iinkai = vocabRow("委員会");
  assert.ok(taberu && iinkai);
  assert.ok(
    taberu.beginnerRank < iinkai.beginnerRank,
    `食べる (${taberu.beginnerRank}) should precede 委員会 (${iinkai.beginnerRank})`,
  );
  // And a money-shot word lands in the everyday core, not adrift.
  const anata = vocabRow("あなた");
  assert.ok(anata && anata.beginnerRank <= 50, "あなた fell out of the first 50");
});

test("the JLPT-unjoined tail sorts after the whole beginner curriculum", () => {
  // ~50% of words join neither JLPT list; they are advanced/rare and are given
  // ranks AFTER every gated word. 委員会 is one such word — it must sit deep in
  // the tail, far below the ~6,200-word beginner core, not merely somewhere.
  const iinkai = vocabRow("委員会");
  assert.ok(iinkai && iinkai.beginnerRank > 6000, "委員会 leaked into the beginner core");
});

test("subtitle drama-skew is capped: 死ぬ is demoted out of the first 50", () => {
  // 死ぬ (to die) reaches OpenSubtitles rank ~20 and would otherwise gate-crash
  // the opening words. The MORBID demotion in beginnerrank.py drops it to the
  // end of its JLPT band; it stays in the vocabulary, just not up front.
  const shinu = vocabRow("死ぬ");
  assert.ok(shinu && shinu.beginnerRank > 50, `死ぬ (${shinu?.beginnerRank}) was not demoted`);
});

test("every component is charged, jōyō or not", () => {
  // 無 = ｜ノ一杰乞. 杰 is an 8-stroke NON-jōyō primitive, so it is never an
  // item — but something must have paid for it before 無 is taught, or the
  // "novel strokes" number is the old lie in new clothes.
  const mu = KANJI_ORDER.find((o) => o.c === "無");
  assert.ok(mu);
  const payer = KANJI_ORDER.find(
    (o) => (kanjiRow(o.c)?.comps ?? []).includes("杰") && o.i < mu.i,
  );
  assert.ok(payer, "無 is taught before anything charged for 杰");
  assert.ok(payer.novelStrokes >= 8, `${payer.c} got 杰 for free`);
});

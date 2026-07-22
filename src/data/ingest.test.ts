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
import {
  KANJI,
  KANJI_FACTS,
  KANJI_ORDER,
  PREREQUISITE_ONLY,
  RADICAL_INDEX_MEANING,
  COUNTER_MEANING,
  ZODIAC_MEANING,
  READINGS,
  kanjiRow,
  variantTaughtKanji,
} from "./kanji.ts";
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
  //
  // Read off `costParts` (KRADFILE), not `comps`: novelStrokes is a KRADFILE
  // stroke-cost figure, so the decomposition that explains it is the same one it
  // was computed from. `comps` is now KanjiVG's depth-1 hierarchy and would not
  // surface a deep primitive like 杰 at all.
  const mu = KANJI_ORDER.find((o) => o.c === "無");
  assert.ok(mu);
  const payer = KANJI_ORDER.find(
    (o) => (kanjiRow(o.c)?.costParts ?? []).includes("杰") && o.i < mu.i,
  );
  assert.ok(payer, "無 is taught before anything charged for 杰");
  assert.ok(payer.novelStrokes >= 8, `${payer.c} got 杰 for free`);
});

test("radical-index metadata is stripped from meanings, real 'radical' meanings are not", () => {
  // KANJIDIC2 files a character's Kangxi radical NUMBER as an English meaning:
  // 一 ships as ["one", "one radical (no.1)"], 二 as ["two", "two radical (no.
  // 7)"]. It is catalogue metadata, and it reached the learner twice over — as
  // the Library entry's page title, and inside question.ts as both an accepted
  // answer and a multiple-choice distractor for a MEANING question.
  //
  // THE FILTER IS THE NUMBER, NOT THE WORD. This is the whole test: 基 really
  // does mean "radical (chem)" — a chemical radical — and 偏 really does mean
  // "left-side radical". A filter matching "radical" would delete correct
  // meanings, which is a worse bug than the one it fixes.
  const one = kanjiRow("一");
  assert.ok(one);
  assert.deepEqual(one.meanings, ["one"]);

  const chem = kanjiRow("基");
  assert.ok(chem);
  assert.ok(
    chem.meanings.includes("radical (chem)"),
    `基 lost its chemical radical: ${chem.meanings.join(", ")}`,
  );
  const hen = kanjiRow("偏");
  assert.ok(hen?.meanings.includes("left-side radical"), "偏 lost its real meaning");

  // And nothing anywhere still carries the numbered form. This is the assertion
  // that catches a re-cut done with the filter dropped.
  for (const k of KANJI) {
    for (const m of k.meanings) {
      assert.ok(!RADICAL_INDEX_MEANING.test(m), `${k.c} still ships "${m}"`);
    }
  }

  // No kanji was emptied by the filter — a meaning fact with no answers is
  // ungradeable, and 22 rows losing their ONLY meaning would be a silent
  // regression rather than a fix.
  assert.equal(KANJI.filter((k) => k.meanings.length === 0).length, 0);
});

test("counter and zodiac/branch metadata is stripped from meanings, real meanings are not", () => {
  // KANJIDIC2 files a character's COUNTER role and its ZODIAC/terrestrial-branch
  // role as if they were English meanings. They reach the learner exactly as the
  // radical index did — as the taught meaning, an accepted answer and a
  // distractor for a MEANING question. Same structural fix, extended.
  //
  // 子 shipped ["child", "sign of the rat", "11PM-1AM", "first sign of Chinese
  // zodiac"] and 子 means "child". 張 LED with "counter for bows & stringed
  // instruments" — a grammatical classifier, not what 張 means.
  assert.deepEqual(kanjiRow("子")?.meanings, ["child"]);
  assert.deepEqual(kanjiRow("張")?.meanings, ["stretch", "spread", "put up (tent)"]);
  assert.deepEqual(kanjiRow("午")?.meanings, ["noon"]);
  assert.deepEqual(kanjiRow("申")?.meanings, ["have the honor to"]);

  // THE FILTER IS THE PATTERN, NOT THE WORD. "counterfeit" and "encounter" both
  // contain "counter" and are real meanings; the anchored "counter for" spares
  // them. 基's "radical (chem)" already proved the same point for radicals.
  assert.ok(kanjiRow("基")?.meanings.includes("radical (chem)"));
  assert.ok(!COUNTER_MEANING.test("counterfeit"));
  assert.ok(!COUNTER_MEANING.test("encounter"));

  // Nothing still ships a counter or zodiac/branch gloss, EXCEPT a row whose
  // only KANJIDIC2 sense is metadata (the zero-guard keeps it — see below). This
  // catches a re-cut done with the filter dropped.
  for (const k of KANJI) {
    if (k.meanings.length === 1) continue; // zero-guard survivor
    for (const m of k.meanings) {
      assert.ok(!COUNTER_MEANING.test(m), `${k.c} still ships counter "${m}"`);
      assert.ok(!ZODIAC_MEANING.test(m), `${k.c} still ships zodiac "${m}"`);
    }
  }

  // The zero-guard: 箇's ONLY KANJIDIC2 sense is "counter for articles". A blind
  // filter would empty it — an ungradeable meaning fact — so its sense is kept.
  assert.deepEqual(kanjiRow("箇")?.meanings, ["counter for articles"]);
  assert.equal(KANJI.filter((k) => k.meanings.length === 0).length, 0);
});

test("a reading is anchored to the everyday word that attests it earliest", () => {
  // A learner meets the ANCHOR word before the reading, so an obscure anchor
  // makes a common reading feel rare: 出's しゅつ shipped anchored to 供出
  // (beginnerRank 8388) when 出発 (696) attests it too, and 名's みょう to 功名
  // (8337) over 本名 (4567). The anchor must be the attesting word with the
  // LOWEST beginnerRank — the first one the learner will actually meet.
  const shutsu = READINGS.find((r) => r.k === "出" && r.base === "しゅつ");
  assert.equal(shutsu?.anchor, "出発");
  const myou = READINGS.find((r) => r.k === "名" && r.base === "みょう");
  assert.equal(myou?.anchor, "本名");

  // The property, everywhere: no reading is anchored to a word when a
  // lower-beginnerRank word in its own evidence list attests the same reading —
  // EXCEPT an ambiguous word where the kanji reads more than one base (時々 has
  // 時 as both とき and どき), which cannot anchor either reading and is skipped.
  const ambiguous = (word: string, k: string): boolean => {
    const bases = new Set(
      (vocabRow(word)?.align ?? []).filter(([kk]) => kk === k).map(([, , bb]) => bb),
    );
    return bases.size > 1;
  };
  for (const r of READINGS) {
    const anchorRank = vocabRow(r.anchor)?.beginnerRank ?? Number.MAX_SAFE_INTEGER;
    for (const w of r.words) {
      if (ambiguous(w, r.k)) continue;
      const wr = vocabRow(w)?.beginnerRank ?? Number.MAX_SAFE_INTEGER;
      assert.ok(
        wr >= anchorRank,
        `${r.k}/${r.base} anchored to ${r.anchor} (rank ${anchorRank}) over ${w} (rank ${wr})`,
      );
    }
  }

  // An anchor is ambiguous only when the reading has NO unambiguous attestation
  // (共's ども appears solely in 共々, where 共 is both とも and ども) — there the
  // ambiguous word is the only evidence and must stand, exactly as the raw data
  // had it. Every reading with any unambiguous option must take one.
  for (const r of READINGS) {
    if (ambiguous(r.anchor, r.k)) {
      assert.ok(
        r.words.every((w) => ambiguous(w, r.k)),
        `${r.k}/${r.base} anchored on ambiguous ${r.anchor} when an unambiguous word exists`,
      );
    }
  }

  // The uniqueness the fact id depends on: within a kanji, no two readings share
  // an anchor (that would mint one id for two facts and drop one). The
  // ambiguity exclusion is what makes this hold after re-anchoring by rank.
  const perKanji = new Map<string, Set<string>>();
  for (const r of READINGS) {
    const seen = perKanji.get(r.k) ?? new Set<string>();
    assert.ok(!seen.has(r.anchor), `${r.k} has two readings anchored on ${r.anchor}`);
    seen.add(r.anchor);
    perKanji.set(r.k, seen);
  }
});

test("every reading knows whether it came from Chinese or is native Japanese", () => {
  // KANJIDIC2's r_type is the only thing in the data that can answer "why do
  // 一's いち and ひと sound nothing alike". Without it the entry page's table
  // lists both as bare readings and they look arbitrary.
  const typed = READINGS.filter((r) => r.type);
  assert.equal(typed.length, READINGS.length, "some reading has no type");

  const of = (k: string, base: string) => READINGS.find((r) => r.k === k && r.base === base);
  assert.equal(of("一", "いち")?.type, "on", "いち is the borrowed Chinese reading");
  assert.equal(of("一", "ひと")?.type, "kun", "ひと is the native Japanese word");
  assert.equal(of("生", "せい")?.type, "on");
  assert.equal(of("生", "い")?.type, "kun");

  // `both` is a real answer, not a tie the ingest failed to break: KANJIDIC2
  // lists these under ja_on AND ja_kun for different senses, and the UI says so
  // rather than picking one the dictionary does not.
  assert.ok(
    READINGS.some((r) => r.type === "both"),
    "the both-types case vanished; check the normalisation still collapses イチ→いち",
  );
});

test("the 'Made of' components are KanjiVG depth-1, not the KRADFILE flat walk", () => {
  // This is the P0 fix, pinned so a regeneration cannot silently reintroduce it
  // (tasks/23-p0-kanji-components-wrong.md). Each `should` is the depth-1 child
  // list of the KanjiVG element hierarchy; the `wasBug` note is what the old
  // KRADFILE-derived comps produced.
  const comps = (c: string): readonly string[] => kanjiRow(c)?.comps ?? [];

  // 亻 (person), NOT 化 (change): KRADFILE encoded the person radical as 化.
  assert.deepEqual(comps("休"), ["亻", "木"], "休 is a person beside a tree");
  assert.ok(!comps("休").includes("化"), "休 must never list 化");
  assert.deepEqual(comps("仁"), ["亻", "二"]);

  // 寺 kept whole — the phonetic shared with 持 待 詩 侍 — not flattened to 土+寸.
  assert.deepEqual(comps("時"), ["日", "寺"], "時 keeps its phonetic 寺");

  // 化 is preserved where it is GENUINELY present (艹 + 化, 化 + 貝).
  assert.ok(comps("花").includes("化"), "花 really does contain 化");
  assert.deepEqual(comps("花"), ["艹", "化"]);
  assert.deepEqual(comps("貨"), ["化", "貝"], "no more 化+貝+目+ハ+匕");

  // Already-correct cases stay correct; nested parts are dropped (言+吾, not 言+口+五).
  assert.deepEqual(comps("明"), ["日", "月"]);
  assert.deepEqual(comps("語"), ["言", "吾"]);
  assert.deepEqual(comps("校"), ["木", "交"]);
  assert.deepEqual(comps("男"), ["田", "力"]);

  // A pictograph atomic to KanjiVG has no "Made of" row at all.
  assert.deepEqual(comps("生"), []);
});

test("a variant component displays its own shape but links to the taught character", () => {
  // 亻 is written as 亻, never 人 — but it is a form of 人, which the learner DOES
  // meet, so the "Made of" row lets them tap through. variantTaughtKanji is that
  // resolution; the display char (亻) is unchanged, only the link target.
  assert.equal(variantTaughtKanji("亻"), "人", "亻 links to 人");
  assert.equal(variantTaughtKanji("氵"), "水", "氵 links to 水");
  assert.equal(variantTaughtKanji("刂"), "刀", "刂 links to 刀");
  // A variant of a character we do NOT teach stays an unlinked plain shape.
  assert.equal(variantTaughtKanji("艹"), undefined, "艸 is not a taught kanji");
  // A real taught kanji is not a variant of anything — it links to itself.
  assert.equal(variantTaughtKanji("木"), undefined);
});

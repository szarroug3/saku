// Run: node --test src/data/audit-dictionary.test.ts
//
// Uses node:test + native TypeScript stripping (Node 24). No test framework, no
// new dependencies.
//
// WHY THIS FILE EXISTS — AND WHY IT IS NOT ingest.test.ts
// ======================================================
// ingest.test.ts pins the SHAPE of the derivation (counts, the grade set, fact-id
// uniqueness, the sense merge, the rendaku fold, the anchor-by-rank re-pick). This
// file pins the JOIN INTEGRITY the derivation depends on but that file never
// asserts directly: that every computed reading fact still points at real,
// self-consistent evidence after `reattest`/`reanchor` have run.
//
// The reading facts are the fragile part. A ReadingRow is COMPUTED (kanji.ts:
// `reattest` recomputes `words` from the vocabulary served today, `reanchor`
// re-picks the anchor by beginnerRank), and its `anchor`/`words` are the join back
// to the vocabulary subject. A join is silent when it breaks: an anchor that no
// longer resolves to a word, a proving word whose per-kanji breakdown no longer
// contains the reading, a surface that disagrees with the anchor's own alignment —
// none of these throw, they just render a card that proves nothing. So the join is
// asserted here, on the shipped (post-transform) data.
//
// Everything below passes against the data as shipped; each assertion is a guard
// against a FUTURE re-cut or transform change silently breaking the join.

import assert from "node:assert/strict";
import test from "node:test";

import { KANJI, READINGS, kanjiRow } from "./kanji.ts";
import { RADICALS, radicalOfKanji } from "./radicals.ts";
import { VOCAB, vocabRow, readingUnits } from "./vocab.ts";

// The grade set jōyō actually uses. ingest.test.ts asserts the set EQUALS this;
// here we use it as a range membership check on every row individually, which
// localises a bad grade to a character.
const JOYO_GRADES = new Set([1, 2, 3, 4, 5, 6, 8]);

test("every kanji row is structurally sound: grade, strokes, meanings, freq", () => {
  for (const k of KANJI) {
    assert.ok(JOYO_GRADES.has(k.grade), `${k.c} has non-jōyō grade ${k.grade}`);
    assert.ok(
      Number.isInteger(k.strokes) && k.strokes > 0,
      `${k.c} has non-positive stroke count ${k.strokes}`,
    );
    // A meaning fact with no answers is ungradeable. The metadata filter in
    // kanji.ts has a zero-guard for exactly this; assert it held.
    assert.ok(k.meanings.length > 0, `${k.c} has no meanings and cannot be quizzed`);
    for (const m of k.meanings) {
      assert.ok(m.length > 0, `${k.c} has an empty-string meaning`);
    }
    // KANJIDIC2's newspaper rank is 1..2,501 or null (see KanjiRow). A rank of 0
    // or a negative would sort ahead of 人; catch it here rather than in a queue.
    assert.ok(
      k.newspaperFreq === null ||
        (Number.isInteger(k.newspaperFreq) &&
          k.newspaperFreq >= 1 &&
          k.newspaperFreq <= 2501),
      `${k.c} has out-of-range newspaperFreq ${k.newspaperFreq}`,
    );
  }
});

test("every reading fact points at a kanji the app actually teaches", () => {
  // READINGS is keyed on `k`; if `k` is not a jōyō row, buildKanjiFacts silently
  // skips it (the `if (!k) continue`) and the reading fact vanishes with no error.
  for (const r of READINGS) {
    assert.ok(kanjiRow(r.k), `reading ${r.k}/${r.base} is for a non-jōyō character`);
  }
});

test("every proving word exists, contains the kanji, and attests the base reading", () => {
  // The join `reattest` rebuilds. Each word in a reading's evidence list must (a)
  // resolve to a real vocabulary row — otherwise "learned in <word>" links nowhere
  // — (b) actually contain the kanji, and (c) carry that exact base in its own
  // per-kanji alignment. (c) is the one that catches a stale evidence list: a word
  // whose primary reading drifted no longer attests what it is filed under.
  for (const r of READINGS) {
    for (const w of r.words) {
      const row = vocabRow(w);
      assert.ok(row, `reading ${r.k}/${r.base}: proving word ${w} is not in the vocabulary`);
      assert.ok(
        [...w].includes(r.k),
        `reading ${r.k}/${r.base}: proving word ${w} does not contain ${r.k}`,
      );
      const attests = (row.align ?? []).some(([kk, , bb]) => kk === r.k && bb === r.base);
      assert.ok(
        attests,
        `reading ${r.k}/${r.base}: ${w}'s alignment does not attest ${r.base}`,
      );
    }
    // nWords is evidence weight and entries.ts sorts on it; it must equal the list
    // it counts, or the readings table sorts on a number the data does not support.
    assert.equal(
      r.nWords,
      r.words.length,
      `reading ${r.k}/${r.base}: nWords ${r.nWords} disagrees with ${r.words.length} words`,
    );
  }
});

test("every anchor is a real word that contains the kanji and surfaces the base as claimed", () => {
  // The anchor is what makes a reading fact askable ("what is 生 read as in 人生").
  // It must resolve, contain the kanji, and — the load-bearing part — its own
  // alignment must surface the base exactly as `surface` says, because that surface
  // IS the graded answer (buildKanjiFacts: `answers: [r.surface, ...]`). A surface
  // that disagrees with the anchor grades a reading the anchor does not show.
  for (const r of READINGS) {
    // A reading whose every attesting word moved away keeps its anchor and simply
    // stops being unlockable (kanji.ts: 仏's ふつ). Such a row is exempt from the
    // "anchor is in words" join, but the anchor must still be a real word.
    const arow = vocabRow(r.anchor);
    assert.ok(arow, `reading ${r.k}/${r.base}: anchor ${r.anchor} is not in the vocabulary`);
    assert.ok(
      [...r.anchor].includes(r.k),
      `reading ${r.k}/${r.base}: anchor ${r.anchor} does not contain ${r.k}`,
    );
    if (r.words.length > 0) {
      assert.ok(
        r.words.includes(r.anchor),
        `reading ${r.k}/${r.base}: anchor ${r.anchor} is not among its own proving words`,
      );
    }
    const m = (arow.align ?? []).find(([kk, , bb]) => kk === r.k && bb === r.base);
    if (m) {
      assert.equal(
        m[1],
        r.surface,
        `reading ${r.k}/${r.base}: surface ${r.surface} disagrees with anchor ${r.anchor}'s ${m[1]}`,
      );
    }
  }
});

// ---------------------------------------------------------------------------
// RADICALS. The 214 classical Kangxi radicals (radicals.ts / radicals.json). The
// app teaches each radical's MEANING as its headline fact and gates a kanji on it,
// so a wrong or missing radical meaning is a taught error, and a kanji whose
// classical radical does not resolve is a kanji taught with an unmet gate.
// ---------------------------------------------------------------------------

test("the 214 radicals are a complete, sound Kangxi table", () => {
  // Kangxi numbers a radical 1..214, one glyph and one meaning each. A duplicate
  // number or glyph collapses two radicals into one entry id (radical:水), and an
  // empty meaning is an ungradeable headline fact.
  assert.equal(RADICALS.length, 214);
  const nums = RADICALS.map((r) => r.num);
  const glyphs = RADICALS.map((r) => r.glyph);
  assert.equal(new Set(nums).size, 214, "a Kangxi number is used twice");
  assert.equal(new Set(glyphs).size, 214, "a radical glyph is used twice");
  assert.equal(Math.min(...nums), 1);
  assert.equal(Math.max(...nums), 214);
  for (const r of RADICALS) {
    assert.ok(r.glyph.length > 0, `radical ${r.num} has no glyph`);
    assert.ok(r.meaning.length > 0, `radical ${r.num} has no meaning and cannot be taught`);
    assert.ok(
      Number.isInteger(r.strokes) && r.strokes > 0,
      `radical ${r.num} has non-positive strokes ${r.strokes}`,
    );
  }
});

test("the taught radical meanings are the ones a learner is shown", () => {
  // Canaries on the meaning column: these are the exact Unicode Kangxi Radical
  // names the app prints as a radical's headline. A re-cut that shifts the meaning
  // column (wrong source, off-by-one against the number) trips at least one.
  const meaningOf = (num: number) => RADICALS.find((r) => r.num === num)?.meaning;
  assert.equal(meaningOf(10), "legs", "儿 is legs");
  assert.equal(meaningOf(31), "enclosure", "囗 is enclosure");
  assert.equal(meaningOf(85), "water", "水 is water");
  assert.equal(meaningOf(86), "fire", "火 is fire");
  assert.equal(meaningOf(61), "heart", "心 is heart");
  assert.equal(meaningOf(140), "grass", "艸 is grass");
});

test("every jōyō kanji files under a real, named radical", () => {
  // The kanji→radical join (kanji-radicals.json). The ingest promises it is
  // complete over all 2,136; a kanji with no radical is taught with a gate that
  // points nowhere, and one pointing at an unnamed radical gates on a blank card.
  for (const k of KANJI) {
    const r = radicalOfKanji(k.c);
    assert.ok(r, `${k.c} files under no classical radical`);
    assert.ok(r.meaning.length > 0, `${k.c} files under radical ${r.num}, which has no meaning`);
  }
});

test("every word has a non-empty primary reading and gloss, in every reading-unit", () => {
  // The lesson prints the primary reading and gloss unconditionally, and every
  // reading fact grades on `reb` while every meaning fact grades on the unit's
  // glosses. An empty reb or an empty gloss list is an ungradeable fact and a blank
  // panel. ingest.test.ts checks facts have >0 answers; this checks the SOURCE
  // fields those answers are read from, per reading-unit.
  for (const w of VOCAB) {
    assert.ok(w.reb.length > 0, `${w.keb} has an empty primary reading`);
    assert.ok(w.glosses.length > 0 && w.glosses[0].length > 0, `${w.keb} has an empty primary gloss`);
    for (const u of readingUnits(w)) {
      assert.ok(u.reb.length > 0, `${w.keb} has a reading-unit with an empty reading`);
      assert.ok(
        u.glosses.length > 0 && u.glosses.every((g) => g.length > 0),
        `${w.keb}'s ${u.reb} unit has an empty gloss`,
      );
    }
  }
});

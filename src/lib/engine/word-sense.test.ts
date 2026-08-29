// SAK-225 — a word whose reading pools more than one genuinely distinct
// JMdict sense (そう: "appearing that" the auxiliary vs "in that way" the
// adverb) must grade a meaning-card answer against the ONE sense the showing
// is asking about, not the union of every sense sharing that reading.
//
// Before this fix, `readingUnits` pooled every sense's glosses into a single
// answer set and `wordQuestions.check` graded against the whole pool — so an
// answer that was only correct for the OTHER sense passed anyway, with no
// signal the two were different. The Library page, by contrast, already
// lists these as separate meanings; this brings the quiz in line with it.
//
//   node --import ./src/lib/conjugate/test-hooks.mjs --test src/lib/engine/word-sense.test.ts

import test from "node:test";
import assert from "node:assert/strict";

import {
  readingUnits,
  vocabRow,
  wordMeaningFactId,
  wordReadingFactId,
} from "@/data/vocab";
import { revealFor, wordSenseFor, type PromptContext } from "@/lib/engine/question";
import { checkTyped } from "@/lib/engine/index";

function ctxWith(wordSense: readonly string[] | undefined): PromptContext {
  return { wordSense };
}

function senseGroupsOf(keb: string): readonly (readonly string[])[] {
  const unit = readingUnits(vocabRow(keb)!).find(
    (u) => u.senseGroups && u.senseGroups.length > 1,
  );
  assert.ok(unit, `${keb} should carry a reading with more than one distinct sense`);
  return unit!.senseGroups!;
}

test("readingUnits: そう carries two distinct senses under one reading, not a flat pool", () => {
  const groups = senseGroupsOf("そう");
  assert.equal(groups.length, 2, "そう pools exactly two JMdict entries");
  // The flat union still carries every gloss from both senses — a reading
  // card's definition-line context is untouched by this fix.
  const unit = readingUnits(vocabRow("そう")!).find((u) => u.reb === "そう")!;
  for (const gloss of groups.flat()) {
    assert.ok(unit.glosses.includes(gloss), `union should still include "${gloss}"`);
  }
});

test("wordSenseFor: null for a reading fact, for en2jp, and for a single-sense word", () => {
  const soReading = wordReadingFactId("そう");
  const soMeaning = wordMeaningFactId("そう");
  const senseiMeaning = wordMeaningFactId("先生"); // one entry, one sense
  assert.equal(
    wordSenseFor(soReading, "jp2en"),
    null,
    "a reading fact's answer is the kana reading, never pooled across senses",
  );
  assert.equal(
    wordSenseFor(soMeaning, "en2jp"),
    null,
    "a word is only ever asked jp2en (fixedDir)",
  );
  assert.equal(
    wordSenseFor(senseiMeaning, "jp2en"),
    null,
    "a single-sense word has only one pool — nothing to pick between",
  );
});

test("wordSenseFor: rolls one of そう's two senses, chosen by the injected rng", () => {
  const meaning = wordMeaningFactId("そう");
  const first = wordSenseFor(meaning, "jp2en", () => 0);
  const second = wordSenseFor(meaning, "jp2en", () => 0.999999);
  assert.ok(first && second, "both rolls should return a sense");
  assert.notDeepEqual(first, second, "the two rolls must land on the two DIFFERENT senses");
});

test("SAK-225: a meaning card scoped to one sense of そう rejects the OTHER sense's answer", () => {
  const meaning = wordMeaningFactId("そう");
  const [senseA, senseB] = senseGroupsOf("そう");

  // Scoped to sense A, sense A's own gloss is accepted...
  assert.equal(checkTyped(meaning, senseA[0], "jp2en", ctxWith(senseA)), true);
  // ...but sense B's gloss — correct for the OTHER meaning — is rejected. This
  // is the exact bug: "in that way" used to grade as correct even when the
  // card was scoped to "appearing that", and vice versa.
  assert.equal(checkTyped(meaning, senseB[0], "jp2en", ctxWith(senseA)), false);

  // And symmetrically when the OTHER sense is the one rolled for this showing.
  assert.equal(checkTyped(meaning, senseB[0], "jp2en", ctxWith(senseB)), true);
  assert.equal(checkTyped(meaning, senseA[0], "jp2en", ctxWith(senseB)), false);
});

test("SAK-225: with no rolled sense, a caller that never asked (no ctx) keeps the old pooled grading", () => {
  // A reader that doesn't go through the drill's per-showing roll — search,
  // stats, a hand-built ctx-less call — is untouched: `info.answers` (and
  // therefore `checkJp2en` with no ctx) still pools every sense, exactly as
  // it did before this fix.
  const meaning = wordMeaningFactId("そう");
  const [senseA, senseB] = senseGroupsOf("そう");
  assert.equal(checkTyped(meaning, senseA[0], "jp2en"), true);
  assert.equal(checkTyped(meaning, senseB[0], "jp2en"), true);
});

test("SAK-225: revealFor shows the sense actually asked, not always the pooled first gloss", () => {
  const meaning = wordMeaningFactId("そう");
  const [senseA, senseB] = senseGroupsOf("そう");
  assert.equal(revealFor(meaning, "jp2en", ctxWith(senseA)), senseA[0]);
  assert.equal(revealFor(meaning, "jp2en", ctxWith(senseB)), senseB[0]);
});

test("SAK-225 generalizes beyond そう: two more of the ~30 affected words are scoped the same way", () => {
  for (const keb of ["ぼける", "つける"]) {
    const meaning = wordMeaningFactId(keb);
    const [senseA, senseB] = senseGroupsOf(keb);
    assert.equal(checkTyped(meaning, senseA[0], "jp2en", ctxWith(senseA)), true, keb);
    assert.equal(checkTyped(meaning, senseB[0], "jp2en", ctxWith(senseA)), false, keb);
    assert.equal(checkTyped(meaning, senseB[0], "jp2en", ctxWith(senseB)), true, keb);
    assert.equal(checkTyped(meaning, senseA[0], "jp2en", ctxWith(senseB)), false, keb);
  }
});

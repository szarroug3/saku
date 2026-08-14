// THE SAFETY NET for word-rank.json — asserts the precomputed beginnerRank and
// curriculum membership match the live dictionary for every word, since
// keigo.ts's set ordering, the Library word shelf's tail rank, and
// transitivity-lesson.ts's pair gate all now read from here instead.

import { test } from "node:test";
import assert from "node:assert/strict";

import { VOCAB, vocabRow } from "@/data/vocab";
import { CURRICULUM_WORDS } from "@/lib/word-lesson";
import { wordBeginnerRank, isCurriculumWord, CURRICULUM_KEBS_ORDERED } from "@/lib/word-rank";

test("wordBeginnerRank matches live vocabRow(keb).beginnerRank for every word", () => {
  for (const w of VOCAB) {
    assert.equal(wordBeginnerRank(w.keb), vocabRow(w.keb)?.beginnerRank, `keb ${w.keb}`);
  }
});

test("wordBeginnerRank is undefined for a keb the dictionary doesn't have", () => {
  assert.equal(wordBeginnerRank("not-a-real-word-xyz"), undefined);
});

test("isCurriculumWord matches live CURRICULUM_WORDS membership for every VOCAB word", () => {
  const liveMembership = new Set(CURRICULUM_WORDS.map((w) => w.keb));
  for (const w of VOCAB) {
    assert.equal(isCurriculumWord(w.keb), liveMembership.has(w.keb), `keb ${w.keb}`);
  }
});

test("CURRICULUM_KEBS_ORDERED matches live CURRICULUM_WORDS kebs, in order", () => {
  assert.deepEqual(CURRICULUM_KEBS_ORDERED, CURRICULUM_WORDS.map((w) => w.keb));
});

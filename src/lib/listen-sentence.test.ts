// Run:
//   node --import ./src/lib/conjugate/test-hooks.mjs --test src/lib/listen-sentence.test.ts
//
// SENTENCE-LISTENING RECOGNITION (this task): hear a sentence, pick its English
// meaning. These pin the properties that let a sentence be graded at all without
// breaking "never mark correct Japanese wrong":
//   - non-gating: a learner with no known words is served nothing (null);
//   - every served sentence is within the learner's known-words set (the gate);
//   - NO distractor is a correct reading of the audio — the board is unambiguous,
//     so a right pick can never be marked wrong;
//   - the audio prompt never leaks the played sentence as visible text.

import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { CORPUS } from "@/data/grammar/corpus";
import { VOCAB, wordMeaningFactId } from "@/data/vocab";
import { lemmaKnown } from "@/lib/grammar/readable";
import {
  ambiguousMeanings,
  boardIsUnambiguous,
  gradeRecognition,
  pickRecognition,
  readableRecognition,
} from "./listen-sentence.ts";
import type { HistoryFile } from "@/types";

// A deterministic rng, so a rolled board is reproducible. Copied from
// substitution.test.ts's approach.
function seeded(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

const T = 1_700_000_000_000;
/** A learner who knows the WHOLE vocabulary — the widest readable pool, so a
 * roll never runs dry and the gate/ambiguity tests have plenty to draw on. */
const ALL_KNOWN: HistoryFile = {
  sessions: [],
  facts: {},
  claims: Object.fromEntries(VOCAB.map((w) => [wordMeaningFactId(w.keb), T])),
};
/** A learner who knows exactly one common word — a deliberately tiny set, to
 * prove the gate actually EXCLUDES rather than waving everything through. */
const ONE_WORD: HistoryFile = {
  sessions: [],
  facts: {},
  claims: { [wordMeaningFactId("私")]: T },
};
const NOBODY: HistoryFile = { sessions: [], facts: {} };

describe("opt-in and non-gating", () => {
  test("a learner with no known words is served nothing", () => {
    // The whole non-gating guarantee: it never fires for a beginner, and being
    // its own mode it can never appear in or block the drill / pairs / grid flows.
    assert.equal(pickRecognition(NOBODY, seeded(1)), null);
    assert.equal(readableRecognition(NOBODY).length, 0);
  });

  test("the pool grows with what the learner knows, never shrinking the gate to a no-op", () => {
    const wide = readableRecognition(ALL_KNOWN).length;
    const narrow = readableRecognition(ONE_WORD).length;
    assert.ok(wide > 0, "a full vocabulary can read some sentences");
    assert.ok(narrow < wide, "knowing less reads strictly fewer sentences");
    // And the gate is not vacuous: sentences the tiny learner cannot read exist.
    assert.ok(
      CORPUS.length > wide,
      "some corpus sentences are unreadable even at full vocabulary",
    );
  });
});

describe("every served sentence is within the known-words set", () => {
  test("across many rolls, the played sentence's content words are all known", () => {
    const rng = seeded(42);
    const readableIds = new Set(readableRecognition(ONE_WORD).map((e) => e.id));
    let served = 0;
    for (let i = 0; i < 200; i++) {
      const item = pickRecognition(ONE_WORD, rng);
      if (!item) continue;
      served++;
      // The played sentence is one the gate admitted…
      assert.ok(
        readableIds.has(item.id),
        `served ${item.id} is outside the readable set`,
      );
      // …and every content lemma in it is a word this learner knows.
      const ex = CORPUS.find((e) => e.id === item.id)!;
      for (const lemma of ex.v) {
        assert.ok(
          lemmaKnown(lemma, ONE_WORD),
          `served a sentence with unknown lemma ${lemma}`,
        );
      }
    }
    assert.ok(served > 0, "the tiny known set still serves some sentences");
  });
});

describe("no distractor is a correct reading of the audio", () => {
  test("ambiguousMeanings flags identical, entailing, and paraphrase pairs", () => {
    // Identical (bar punctuation/case).
    assert.equal(ambiguousMeanings("I am hungry.", "i am hungry"), true);
    // Entailment: the shorter phrase sits whole inside the longer.
    assert.equal(ambiguousMeanings("I ate.", "I ate rice."), true);
    // Paraphrase: most content words shared.
    assert.equal(
      ambiguousMeanings("The dog is big.", "The big dog."),
      true,
    );
    // Genuinely different meanings may share a board.
    assert.equal(
      ambiguousMeanings("I am hungry.", "She went to Tokyo."),
      false,
    );
  });

  test("every rolled board is unambiguous — one correct answer, no two options the same reading", () => {
    const rng = seeded(7);
    let checked = 0;
    for (let i = 0; i < 500; i++) {
      const item = pickRecognition(ALL_KNOWN, rng);
      if (!item) continue;
      checked++;
      assert.ok(
        boardIsUnambiguous(item),
        `board ${item.id} has an ambiguous pair: ${JSON.stringify(item.options)}`,
      );
      // 3-4 options, exactly one of which is the answer.
      assert.ok(item.options.length >= 3 && item.options.length <= 4);
      assert.equal(item.options[item.correct], item.answer);
      assert.equal(
        item.options.filter((o) => o === item.answer).length,
        1,
      );
    }
    assert.ok(checked > 100, "rolled enough real boards to trust the invariant");
  });

  test("grading is by index against the one correct meaning", () => {
    const item = pickRecognition(ALL_KNOWN, seeded(99))!;
    assert.ok(item);
    assert.equal(gradeRecognition(item, item.correct), true);
    for (let i = 0; i < item.options.length; i++) {
      if (i !== item.correct) assert.equal(gradeRecognition(item, i), false);
    }
  });
});

describe("the audio prompt never leaks its answer as visible text", () => {
  test("the played Japanese sentence is never one of the visible options", () => {
    const rng = seeded(123);
    let checked = 0;
    for (let i = 0; i < 300; i++) {
      const item = pickRecognition(ALL_KNOWN, rng);
      if (!item) continue;
      checked++;
      // The only visible text is the English options. The Japanese that is
      // PLAYED must not appear among them, or the card could be read, not heard.
      assert.ok(
        !item.options.includes(item.jp),
        "the played sentence leaked into the options",
      );
      // The audio is real Japanese, distinct from every English option.
      assert.notEqual(item.jp, item.answer);
    }
    assert.ok(checked > 100);
  });
});

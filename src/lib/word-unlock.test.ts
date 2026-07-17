// Run: node --import ./src/lib/conjugate/test-hooks.mjs --test \
//        src/lib/word-unlock.test.ts
//
// WHAT THESE TESTS ARE FOR
// ========================
// The unlock has one rule and one guarantee, and both are the fix for a shipped
// hole (see word-unlock.ts):
//
//   RULE     — a kanji reading fact is askable iff the user knows a TAUGHT word
//              that attests it. Not before (the reading was never taught) and
//              not on the strength of knowing the KANJI (the kanji track teaches
//              meaning, not reading).
//   GUARANTEE — the question is anchored on a word the user actually learned,
//              never on the ingest's evidence-richest word if that is unlearned.
//              This is the whole "don't ask 生 in 人生 when 人生 was never taught"
//              fix.

import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  meaningFactId as kanjiMeaningFactId,
  readingFactId,
} from "../data/kanji.ts";
import { wordMeaningFactId } from "../data/vocab.ts";
import {
  anchorForFact,
  readingAnchors,
  readingsProvedBy,
  unlockedReadingFacts,
} from "./word-unlock.ts";
import type { FactId, HistoryFile } from "../types/index.ts";

const AT = Date.UTC(2026, 0, 1);

function history(over: Partial<HistoryFile> = {}): HistoryFile {
  return { sessions: [], facts: {}, claims: {}, ...over };
}

function claiming(facts: readonly FactId[]): HistoryFile {
  const claims: Record<string, number> = {};
  for (const f of facts) claims[f] = AT;
  return history({ claims: claims as HistoryFile["claims"] });
}

// 生's せい reading is anchored by the ingest on 人生 (the evidence-richest
// word), but a beginner meets 先生 (rank 74) long before 人生 (rank 1187). This
// is the exact mismatch the unlock exists to fix.
const SEI_FACT: FactId = readingFactId("生", "人生");
const SEN_FACT: FactId = readingFactId("先", "優先");

describe("a reading is askable iff a TAUGHT word attests it", () => {
  test("empty history unlocks nothing", () => {
    assert.equal(unlockedReadingFacts(history()).length, 0);
    assert.equal(anchorForFact(SEI_FACT, history()), undefined);
  });

  test("knowing the KANJI does not unlock its reading", () => {
    // The kanji track teaches meaning. Knowing 生's meaning must NOT make 生's
    // reading askable — a reading is proved by a word, never by the character.
    const h = claiming([kanjiMeaningFactId("生")]);
    assert.ok(!new Set(unlockedReadingFacts(h)).has(SEI_FACT));
  });

  test("learning 先生 unlocks 生's せい reading — the payoff", () => {
    const h = claiming([wordMeaningFactId("先生")]);
    const unlocked = new Set(unlockedReadingFacts(h));
    assert.ok(unlocked.has(SEI_FACT), "生/せい unlocked by 先生");
    assert.ok(unlocked.has(SEN_FACT), "先/せん unlocked by 先生");
  });
});

describe("the question anchors on a word the user actually learned", () => {
  test("先生 known, 人生 not → 生's reading anchors on 先生, not 人生", () => {
    const h = claiming([wordMeaningFactId("先生")]);
    assert.equal(anchorForFact(SEI_FACT, h), "先生");
    assert.equal(readingAnchors(h).get(SEI_FACT), "先生");
  });

  test("the ingest anchor wins when it IS known", () => {
    // Learn 人生 itself — the evidence-richest word — and the reading frames on
    // it, because there is no reason to move off it once it's fair.
    const h = claiming([wordMeaningFactId("人生")]);
    assert.equal(anchorForFact(SEI_FACT, h), "人生");
  });

  test("among several known words, the earliest (lowest rank) is chosen", () => {
    // Know both 先生 (rank 74) and 学生 — the anchor is the more familiar one.
    const h = claiming([
      wordMeaningFactId("先生"),
      wordMeaningFactId("学生"),
    ]);
    assert.equal(anchorForFact(SEI_FACT, h), "先生");
  });

  test("a non-reading fact has no anchor", () => {
    const h = claiming([wordMeaningFactId("先生")]);
    assert.equal(anchorForFact(kanjiMeaningFactId("生"), h), undefined);
  });
});

describe("readingsProvedBy — the write side of the unlock", () => {
  test("teaching 先生 names 生's せい and 先's せん reading facts", () => {
    const proved = new Set(readingsProvedBy(["先生"]));
    assert.ok(proved.has(SEI_FACT), "先生 proves 生/せい");
    assert.ok(proved.has(SEN_FACT), "先生 proves 先/せん");
  });

  test("teaching no words proves nothing", () => {
    assert.equal(readingsProvedBy([]).length, 0);
  });

  test("what a lesson proves is exactly what history then unlocks", () => {
    // The write side (from the taught words) and the read side (from the
    // resulting history) must agree, or a reading is written seen that history
    // would not call unlocked — or the reverse.
    const proved = new Set(readingsProvedBy(["先生"]));
    const unlocked = new Set(
      unlockedReadingFacts(claiming([wordMeaningFactId("先生")])),
    );
    assert.deepEqual([...proved].sort(), [...unlocked].sort());
  });
});

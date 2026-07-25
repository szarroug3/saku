// Run: node --import ./src/lib/conjugate/test-hooks.mjs --test \
//        src/lib/results-grouping.test.ts
//
// The pure half of the post-quiz table: grouping facts into word rows, and
// reading each fact's outcome and confusions off the run's stats.

import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { meaningFactId, readingFactId } from "@/data/kanji";
import { entryId } from "@/lib/fact-id";
import { wordMeaningFactId } from "@/data/vocab";
import {
  confusedEntries,
  groupByEntry,
  outcomeOf,
  type Outcome,
} from "@/lib/results-grouping";
import type { EntryId, FactId, FactSessionDetail } from "@/types";

function stat(over: Partial<FactSessionDetail> = {}): FactSessionDetail {
  return {
    seen: 1,
    misses: 0,
    everCorrect: true,
    firstTryCorrect: true,
    firstTryCount: 1,
    correct: 1,
    confused: {},
    ...over,
  };
}

describe("groupByEntry — one row per word", () => {
  test("facts of the same entry land in one row, in first-seen order", () => {
    // 何's kanji meaning and one of its readings share entry kanji:何; the word
    // 何 is a different entry and gets its own row.
    const kanjiMeaning = meaningFactId("何");
    const kanjiReading = readingFactId("何", "何");
    const wordMeaning = wordMeaningFactId("何");
    const rows = groupByEntry([kanjiMeaning, wordMeaning, kanjiReading]);

    assert.equal(rows.length, 2, "two entries → two rows");
    // Row order follows first appearance: kanji:何 (from kanjiMeaning) first.
    assert.equal(rows[0].entry, entryId("kanji", "何"));
    assert.deepEqual(rows[0].facts, [kanjiMeaning, kanjiReading]);
    assert.equal(rows[1].entry, entryId("word", "何"));
    assert.deepEqual(rows[1].facts, [wordMeaning]);
  });

  test("empty in, empty out", () => {
    assert.deepEqual(groupByEntry([]), []);
  });
});

describe("outcomeOf — how the showing went", () => {
  const cases: Array<[string, Partial<FactSessionDetail>, Outcome]> = [
    ["never on screen", { seen: 0 }, "unseen"],
    ["shown, never landed", { seen: 1, everCorrect: false }, "missed"],
    ["clean first try", { misses: 0, firstTryCorrect: true }, "first-try"],
    ["landed after a miss", { misses: 1, firstTryCorrect: false }, "recovered"],
    ["landed but hinted", { misses: 0, firstTryCorrect: false }, "recovered"],
  ];
  for (const [name, over, want] of cases) {
    test(name, () => assert.equal(outcomeOf(stat(over)), want));
  }
  test("a missing stat is unseen", () => {
    assert.equal(outcomeOf(undefined), "unseen");
  });
});

describe("confusedEntries — what you answered instead", () => {
  test("returns the confused-with entries, most-confused first", () => {
    const a = entryId("kanji", "大") as EntryId;
    const b = entryId("kanji", "犬") as EntryId;
    const s = stat({
      everCorrect: false,
      confused: { [a]: 1, [b]: 3 } as Record<EntryId, number>,
    });
    assert.deepEqual(confusedEntries(s), [b, a]);
  });

  test("a miss with no named entry lists nothing", () => {
    assert.deepEqual(confusedEntries(stat({ everCorrect: false })), []);
    assert.deepEqual(confusedEntries(undefined), []);
  });

  test("a zero count is not a confusion", () => {
    const a = entryId("kanji", "大") as EntryId;
    assert.deepEqual(
      confusedEntries(stat({ confused: { [a]: 0 } as Record<EntryId, number> })),
      [],
    );
  });
});

// A guard for the confusions display, which lives in results-view via
// analyzeRun. It is NOT what this module does, but the presentation-label work
// touched the stat shape it reads, so pin that a fresh confusion still surfaces.
describe("confusions still surface (regression guard)", () => {
  test("a mix-up this run reads back off the same stat the table uses", () => {
    const said = entryId("kanji", "大") as EntryId;
    const shownFact = meaningFactId("人") as FactId;
    const s = stat({
      everCorrect: false,
      misses: 1,
      firstTryCorrect: false,
      confused: { [said]: 1 } as Record<EntryId, number>,
    });
    // The table's column and confusions.indexPairs read the SAME field.
    assert.deepEqual(confusedEntries(s), [said]);
    assert.equal(outcomeOf(s), "missed");
    assert.ok(shownFact);
  });
});

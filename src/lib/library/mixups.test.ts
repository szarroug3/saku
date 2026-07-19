import assert from "node:assert/strict";
import { test } from "node:test";

import { kanaEntry, kanaFact } from "@/data/characters";
import { wordEntry } from "@/data/vocab";
import { libEntry } from "@/lib/library/entries";
import { mixupsOf } from "@/lib/library/mixups";
import type { EntryId, FactId, HistoryFile } from "@/types";

function historyWith(fact: FactId, confused: Record<string, number>): HistoryFile {
  return {
    chars: {},
    facts: {},
    sessions: [
      {
        ts: 1,
        facts: {},
        detail: { [fact]: { seen: 1, firstTry: 0, correct: 0, missed: 1, confused } },
      },
    ],
  } as unknown as HistoryFile;
}

// ね, because it HAS shape neighbours (れ, わ) — a subject with an empty
// LOOK_GROUP would make the "never in both lines" test vacuous.
const NE = libEntry(kanaEntry("ね"));
const NE_FACT = kanaFact("ね");

test("no history means no confused line at all", () => {
  assert.ok(NE);
  const m = mixupsOf(NE, [NE_FACT], historyWith(NE_FACT, {}));
  assert.deepEqual(m.confused, []);
  // and the shape line is untouched
  assert.ok(m.lookalike.length > 0, "ね should have lookalikes from LOOK_GROUP");
});

test("a confusion with something that looks NOTHING alike is still reported", () => {
  // THE TEST THAT MATTERS. あ is not in ね's LOOK_GROUP, so a "filter the shape
  // list by history" implementation returns [] here and loses the signal
  // entirely. This asserts it survives.
  assert.ok(NE);
  const a = kanaEntry("あ");
  const shape = mixupsOf(NE, [NE_FACT], historyWith(NE_FACT, {})).lookalike;
  assert.ok(!shape.includes(a), "あ must NOT be a shape neighbour of ね for this test to mean anything");
  const m = mixupsOf(NE, [NE_FACT], historyWith(NE_FACT, { [a]: 3 }));
  assert.deepEqual(m.confused, [a], "a confusion outside the shape list must survive");
});

test("a glyph never appears in both lines", () => {
  assert.ok(NE);
  // Pick a real lookalike of ね and claim it in history.
  const empty = mixupsOf(NE, [NE_FACT], historyWith(NE_FACT, {}));
  const look = empty.lookalike[0];
  assert.ok(look);
  const m = mixupsOf(NE, [NE_FACT], historyWith(NE_FACT, { [look]: 2 }));
  assert.ok(m.confused.includes(look), "it moves into the history line");
  assert.ok(!m.lookalike.includes(look), "and out of the shape line");
});

test("most-confused leads", () => {
  assert.ok(NE);
  const a = kanaEntry("あ");
  const ka = kanaEntry("か");
  const m = mixupsOf(NE, [NE_FACT], historyWith(NE_FACT, { [a]: 1, [ka]: 9 }));
  assert.deepEqual(m.confused, [ka, a]);
});

test("only THIS entry's facts count", () => {
  assert.ok(NE);
  const a = kanaEntry("あ");
  // A confusion recorded against a DIFFERENT fact must not show up here.
  const other = kanaFact("ぬ");
  const m = mixupsOf(NE, [NE_FACT], historyWith(other, { [a]: 5 }));
  assert.deepEqual(m.confused, [], "another fact's confusion is not this entry's");
});

test("a word has neither line", () => {
  // confusableWith returns [] for words, and a word has no shape neighbours.
  const w = libEntry(wordEntry("先生"));
  assert.ok(w);
  const m = mixupsOf(w, [], historyWith("x" as FactId, {}));
  assert.deepEqual(m.confused, []);
  assert.deepEqual(m.lookalike, []);
});

test("an entry is never listed as confused with itself", () => {
  assert.ok(NE);
  const m = mixupsOf(NE, [NE_FACT], historyWith(NE_FACT, { [NE.id as EntryId]: 4 }));
  assert.deepEqual(m.confused, []);
});

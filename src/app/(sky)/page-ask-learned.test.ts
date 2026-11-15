import assert from "node:assert/strict";
import { test } from "node:test";

import { emptyHistory } from "@/lib/history-ops";
import type { FactId } from "@/types/facts";
import type { HistoryFile } from "@/types/store";

import { learnedFrom } from "./page-ask-learned";

const hist = (h: Partial<HistoryFile>): HistoryFile => ({ ...emptyHistory(), ...h });

test("nothing met, nothing learned", () => {
  assert.deepEqual(learnedFrom(emptyHistory()), { kana: "", kanji: [], words: [], grammar: [] });
});

test("claimed, opened and answered facts each count, sorted by kind", () => {
  const learned = learnedFrom(hist({
    claims: { ["kana:し/reading" as FactId]: 1 },
    seen: { ["kanji:食/meaning" as FactId]: 2, ["radical:彳/meaning" as FactId]: 3 },
    facts: { ["word:食べる/reading" as FactId]: { seen: 1 } } as HistoryFile["facts"],
    learnedAt: { ["word:食べる/reading" as FactId]: 4 },
  }));
  assert.equal(learned.kana, "し");
  // the newest first: 彳 was opened after 食
  assert.deepEqual(learned.kanji, ["彳", "食"]);
  assert.equal(learned.words.length, 1);
  assert.match(learned.words[0], /^食べる \(たべる\): /);
  assert.deepEqual(learned.grammar, []);
});

test("a grammar pattern is listed with its meaning", () => {
  const learned = learnedFrom(hist({ claims: { ["grammar:te-request/meaning" as FactId]: 1 } }));
  assert.deepEqual(learned.grammar, ["〜てください: please do X"]);
});

test("a fact with nothing behind it (a stats row of zero) isn't met", () => {
  const learned = learnedFrom(hist({ facts: { ["kana:し/reading" as FactId]: { seen: 0 } } as HistoryFile["facts"] }));
  assert.equal(learned.kana, "");
});

test("a kanji carries the readings the learner has met it in", () => {
  const learned = learnedFrom(hist({ claims: { ["kanji:人/meaning" as FactId]: 1, ["kanji:人/reading@個人" as FactId]: 1, ["kanji:人/reading@人" as FactId]: 1 } }));
  assert.equal(learned.kanji.length, 1);
  assert.match(learned.kanji[0], /^人 \((じん, ひと|ひと, じん)\)$/);
});

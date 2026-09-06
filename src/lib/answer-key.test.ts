// The answer key says what the engine says (SAK-380).
//
// The Sky's quiz grades in the browser, where the engine's tables cannot go,
// so every card carries an AnswerKey worked out on the server and the browser
// runs `matchesKey` against it. That is only safe while the key and the check
// agree, and they are written in two places: `check` in question.ts and
// `answerKey` beside it.
//
// So this grades the WHOLE CURRICULUM both ways. Every fact, both directions,
// a battery of answers built from the fact itself (its right answer, its
// answer mistyped, its romaji, a neighbour's answer, junk), through
// `checkTyped` and through `matchesKey(answerKeyFor(...))`, and asserts the
// two verdicts are the same every time. A change to a check that is not made
// to its key fails here with the fact and the answer that split them.

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { CONSTRUCTION_CATEGORIES, constructionConfigForFact, isConstructionFact } from "@/data/counter-categories";
import { answerKeyFor, checkTyped } from "@/lib/engine";
import { rollConstructionItem } from "@/lib/engine/number-quiz";
import { grammarVehicleFor, wordSenseFor, type PromptContext } from "@/lib/engine/question";
import { keyIsEmpty, matchesKey } from "@/lib/answer-key";
import { ALL_FACTS, factInfo } from "@/lib/facts";
import { emptyHistory } from "@/lib/history-ops";
import type { Direction, FactId } from "@/types";

const DIRECTIONS: readonly Direction[] = ["jp2en", "en2jp"];

/** Romaji probes, tried on every fact. There is no kana-to-romaji in the app
 * to spell each answer with, so instead a fixed handful is thrown at every
 * fact: right for the ones they name, wrong for the rest, and both verdicts
 * have to agree either way. They are what a learner with no IME types. */
const ROMAJI = [
  "a", "i", "u", "e", "o", "ka", "shi", "tsu", "n",
  "sensei", "tabetekudasai", "yonjuunana", "ikkomae", "hitotsu",
  "atarashii", "irasshaimase", "nihon", "kyou",
];

/** Answers worth trying on a fact: what it says, ways of mistyping that, and
 * things that are not it. Built from the fact so every subject gets answers
 * of its own shape rather than one global list of guesses. */
function givensFor(fact: FactId): string[] {
  const info = factInfo(fact);
  const out = new Set<string>(["", " ", "x", "zzzz", "1", "３"]);
  if (!info) return [...out];
  for (const a of info.answers) {
    out.add(a);
    out.add(a.toUpperCase());
    out.add(` ${a} `);
    out.add(a.replace(/\s+/g, "  "));
    // one letter short, and one letter over: the typo layer's territory
    if (a.length > 1) out.add(a.slice(0, -1));
    out.add(`${a}e`);
  }
  out.add(info.glyph);
  out.add(` ${info.glyph} `);
  for (const r of ROMAJI) out.add(r);
  return [...out];
}

describe("the answer key agrees with the engine's own check", () => {
  it("over every fact in the curriculum, both directions", () => {
    const splits: string[] = [];
    let graded = 0;
    for (const fact of ALL_FACTS) {
      const givens = givensFor(fact);
      for (const dir of DIRECTIONS) {
        const key = answerKeyFor(fact, dir);
        for (const given of givens) {
          const engine = checkTyped(fact, given, dir);
          const fromKey = matchesKey(key, given);
          graded++;
          if (engine !== fromKey && splits.length < 20) {
            splits.push(`${fact} ${dir} ${JSON.stringify(given)}: engine ${engine}, key ${fromKey}`);
          }
        }
      }
    }
    assert.deepEqual(splits, [], `the key and the check disagree:\n${splits.join("\n")}`);
    // a guard on the guard: a curriculum that stopped loading would pass an
    // empty loop silently
    assert.ok(graded > 100_000, `only ${graded} answers graded`);
  });

  it("grades a rolled showing the same way: a counting card, a grammar verb, a word's sense", () => {
    // The showings the Sky actually sends. A counting card has no answer until
    // a count is rolled for it, a grammar production card is built on the verb
    // it was asked on, and a word with several senses grades against the one
    // it asked about. All three ride on `ctx`, and all three are exactly where
    // a key that only read the fact would be wrong.
    const splits: string[] = [];
    let rolled = 0;
    const noHistory = emptyHistory();
    // a fixed source of numbers, so a failure can be reproduced
    let n = 0;
    const rng = () => ((n = (n * 1103515245 + 12345) % 2147483648) / 2147483648);

    for (const fact of ALL_FACTS) {
      const contexts: PromptContext[] = [];
      if (isConstructionFact(fact)) {
        const cfg = constructionConfigForFact(fact);
        for (const directions of [["read"], ["write"]] as const) {
          const item = cfg ? rollConstructionItem({ ...cfg, directions: [...directions] }, rng) : null;
          if (item) contexts.push({ numberItem: item });
        }
      }
      const vehicle = grammarVehicleFor(fact, noHistory, rng);
      if (vehicle) contexts.push({ grammarVehicle: vehicle });
      const sense = wordSenseFor(fact, "jp2en", rng);
      if (sense) contexts.push({ wordSense: sense });
      if (!contexts.length) continue;

      const givens = givensFor(fact);
      for (const ctx of contexts) {
        for (const dir of DIRECTIONS) {
          const key = answerKeyFor(fact, dir, ctx);
          for (const given of givens) {
            rolled++;
            const engine = checkTyped(fact, given, dir, ctx);
            if (engine !== matchesKey(key, given) && splits.length < 20) {
              splits.push(`${fact} ${dir} ${JSON.stringify(given)}: engine ${engine}, key ${!engine}`);
            }
          }
        }
      }
    }
    assert.deepEqual(splits, [], `the key and the check disagree on a rolled showing:\n${splits.join("\n")}`);
    assert.ok(rolled > 1000, `only ${rolled} rolled answers graded`);
  });

  it("has an answer for every fact except the ones that need a count rolled first", () => {
    // A counting category (〜本, the tens) has no fixed answer: the count is
    // the question, and it is rolled per showing. Every other fact accepts its
    // own answer with nothing else handed in. Pinned as a list so a fact that
    // quietly stops grading shows up here.
    const noAnswer = ALL_FACTS.filter((f) => {
      const answer = factInfo(f)?.answers[0];
      return !answer || !matchesKey(answerKeyFor(f, "jp2en"), answer);
    });
    const categories = CONSTRUCTION_CATEGORIES.map((c) => c.fact);
    assert.deepEqual([...noAnswer].sort(), [...categories].sort());
    // and the same set is the only one whose key is empty
    const empty = ALL_FACTS.filter((f) => keyIsEmpty(answerKeyFor(f, "jp2en")));
    assert.deepEqual([...empty].sort(), [...categories].sort());
  });
});

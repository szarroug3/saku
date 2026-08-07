// Run: node --import ../lib/conjugate/test-hooks.mjs --test src/data/counter-categories.test.ts
//
// The generative construction CATEGORIES are the drillable side of number
// construction: one `word` fact per number range and per counter, drilled by a
// count the drill rolls per showing. These pin the STRUCTURE (a fact per category,
// filed under Counters, known when its rule was taught) and the ASK CONTRACT that
// reveal-not-prompt.test.ts / quiz-instruction.test.ts exclude the categories from
// because they have no fixed showing: with a rolled item, a category card never
// reveals its own prompt, grades the reveal it prints, and is never a board.

import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  CONSTRUCTION_CATEGORIES,
  CONSTRUCTION_CATEGORY_FACTS,
  constructionConfigForFact,
  constructionFactForMarker,
  isConstructionFact,
  knownConstructionFacts,
} from "./counter-categories.ts";
import {
  CONSTRUCTION_CATEGORY_IDS,
  constructionCategoryEntry,
  constructionMarker,
  COUNTER_ENTRIES,
} from "./counters.ts";
import { wordMeaningFactId } from "./vocab.ts";
import { factType } from "../lib/practice-types.ts";
import { buildMcOptions } from "../lib/engine/index.ts";
import { questionsFor, revealFor } from "../lib/engine/question.ts";
import { makeItem } from "../lib/engine/number-quiz.ts";
import type { Direction, HistoryFile, FactId } from "../types/index.ts";

const BLANK: HistoryFile = { sessions: [], facts: {} };

describe("the categories are well-formed", () => {
  test("one fact per category id, each filed under Counters", () => {
    assert.equal(CONSTRUCTION_CATEGORY_FACTS.length, CONSTRUCTION_CATEGORY_IDS.length);
    for (const cat of CONSTRUCTION_CATEGORIES) {
      assert.ok(isConstructionFact(cat.fact));
      assert.equal(factType(cat.fact), "counter", `${cat.id} files under Counters`);
      assert.ok(COUNTER_ENTRIES.has(cat.entry));
      assert.equal(cat.entry, constructionCategoryEntry(cat.id));
      assert.equal(cat.marker, constructionMarker(cat.id));
      assert.ok(constructionConfigForFact(cat.fact), `${cat.id} has a drill config`);
    }
  });

  test("a plain word is not a construction fact", () => {
    assert.ok(!isConstructionFact(wordMeaningFactId("先生")));
    assert.equal(constructionConfigForFact(wordMeaningFactId("先生")), null);
  });

  test("a counter category counts exactly its own counter", () => {
    const hon = CONSTRUCTION_CATEGORIES.find((c) => c.id === "hon")!;
    assert.equal(hon.config.includeCounters, true);
    assert.deepEqual(hon.config.counters, ["hon"]);
    const tens = CONSTRUCTION_CATEGORIES.find((c) => c.id === "tens")!;
    assert.equal(tens.config.includeCounters, false);
  });
});

describe("a category becomes known when its construction is taught", () => {
  test("nothing is known on a blank history", () => {
    assert.deepEqual(knownConstructionFacts(BLANK), []);
  });

  test("claiming a marker makes exactly that category fact known", () => {
    const honFact = constructionFactForMarker(constructionMarker("hon"))!;
    const history: HistoryFile = {
      sessions: [],
      facts: {},
      claims: { [constructionMarker("hon")]: 1 } as HistoryFile["claims"],
    };
    assert.deepEqual(knownConstructionFacts(history), [honFact]);
  });

  test("a 'quiz me' seen mark also counts as taught", () => {
    const tensFact = constructionFactForMarker(constructionMarker("tens"))!;
    const history: HistoryFile = {
      sessions: [],
      facts: {},
      seen: { [constructionMarker("tens")]: 1 } as HistoryFile["seen"],
    };
    assert.deepEqual(knownConstructionFacts(history), [tensFact]);
  });
});

describe("the ask contract, with a rolled item", () => {
  const honFact = CONSTRUCTION_CATEGORIES.find((c) => c.id === "hon")!.fact;
  const qt = questionsFor(honFact);

  // 3 本 → さんぼん, in each of the three directions. READ shows the number and
  // wants the reading; WRITE shows the reading and wants the number; HEAR plays
  // the reading and wants the number.
  const cases: { dir: Direction; direction: "read" | "write" | "hear"; answer: string }[] = [
    { dir: "jp2en", direction: "read", answer: "さんぼん" },
    { dir: "en2jp", direction: "write", answer: "3" },
    { dir: "jp2en", direction: "hear", answer: "3" },
  ];

  for (const c of cases) {
    test(`${c.direction}: reveals its answer, never its prompt, and grades it`, () => {
      const item = makeItem(3, "hon", c.direction)!;
      const ctx = { numberItem: item };
      const shown = qt.prompt(honFact, c.dir, ctx).glyph.trim();
      const revealed = revealFor(honFact, c.dir, ctx).trim();
      assert.ok(shown.length > 0, "the prompt shows something");
      assert.notEqual(revealed, shown, "the reveal is not the prompt");
      assert.equal(revealed, c.answer, "the reveal is the showing's answer");
      // The grader accepts the revealed answer and rejects a wrong one.
      assert.ok(qt.check(honFact, c.dir, revealed, ctx));
      assert.ok(!qt.check(honFact, c.dir, "zzz", ctx));
    });
  }

  test("a category is never offered as multiple choice", () => {
    // buildMcOptions returns a board of one, which the drill keeps as a typed box
    // — never a board of counts, and never a fabricated board of other word facts.
    for (const cat of CONSTRUCTION_CATEGORIES) {
      assert.equal(buildMcOptions(cat.fact as FactId).length, 1, `${cat.id} gets no board`);
    }
    assert.equal(qt.distractors(honFact, 4, undefined).length, 0);
  });
});

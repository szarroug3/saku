import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { ASSEMBLY } from "@/data/assembly";
import { patternMeaningFactId } from "@/data/grammar";
import { applySeen, emptyHistory } from "@/lib/history-ops";
import type { HistoryFile } from "@/types/store";

import { knownRecipes, recipesOfPick, sentencesToBuild, withinReach } from "./sentence-reach";

const NOW = Date.UTC(2026, 8, 28);
const item = (id: number) => ASSEMBLY.find((it) => it.id === id)!;
const claims = (...ids: string[]): HistoryFile => ({ ...emptyHistory(), claims: Object.fromEntries(ids.map((id) => [patternMeaningFactId(id), NOW])) });

describe("what a pick teaches", () => {
  it("is the pattern for a pattern, both for a pair, nothing for anything else", () => {
    assert.deepEqual(recipesOfPick("grammar:wo"), ["wo"]);
    assert.deepEqual(recipesOfPick("particles:wa-ga"), ["wa", "ga"]);
    assert.deepEqual(recipesOfPick("writing-rule:sentence-rule-simple"), []);
    assert.deepEqual(recipesOfPick("word:水"), []);
  });
});

describe("the patterns a learner knows", () => {
  it("are tonight's picks and everything met: claimed, or opened in a lesson", () => {
    const opened = applySeen(claims("wo"), [patternMeaningFactId("ni")], NOW);
    const known = knownRecipes(opened, ["particles:wa-ga"]);
    assert.deepEqual([...known].sort(), ["ga", "ni", "wa", "wo"]);
    assert.equal(knownRecipes(emptyHistory()).size, 0);
  });
});

describe("a sentence within reach", () => {
  it("turns on known patterns only, with every word in a known form", () => {
    const known = new Set(["wa", "ga", "wo"]);
    assert.equal(withinReach(item(-1), known), true, "私は水を飲む。");
    assert.equal(withinReach(item(-102), known), false, "サクは店に行った。 turns on に");
    assert.equal(withinReach(item(-101), known), false, "サクは寿司を食べた。 is in the た-form, which nothing here explains");
    assert.equal(withinReach(item(-101), new Set(["wa", "ga", "wo", "ta-form"])), true, "and is within reach once the た-form is known");
  });

  it("allows the form a known pattern makes: 行きたい is the stem plus 〜たい", () => {
    assert.equal(withinReach(item(-301), new Set(["e", "tai"])), true);
    assert.equal(withinReach(item(-301), new Set(["e"])), false);
    assert.equal(withinReach(item(-201), new Set(["te-request"])), true, "読んでください");
  });
});

describe("the sentences dealt for a type", () => {
  it("puts what tonight taught first, fills from the rest within reach, and never more than asked", () => {
    const history = claims("wo", "ni");
    const dealt = sentencesToBuild("simple", history, ["grammar:ni"], 5, () => 0.5);
    assert.equal(dealt.length, 5);
    const first = dealt.findIndex((it) => !it.p.includes("ni"));
    const lastNi = dealt.map((it) => it.p.includes("ni")).lastIndexOf(true);
    assert.ok(first === -1 || lastNi < first, "every に sentence comes before any other");
    for (const it of dealt) assert.ok(it.p.every((p) => ["wo", "ni"].includes(p)), `${it.jp} is within reach`);
  });

  it("falls back to any of the type's sentences when nothing is within reach, so a drill is never empty", () => {
    const dealt = sentencesToBuild("conditional", emptyHistory(), [], 5, () => 0.5);
    assert.equal(dealt.length, 5);
  });

  it("deals a type it does not know as nothing", () => {
    assert.deepEqual(sentencesToBuild("nonsense", emptyHistory()), []);
  });
});

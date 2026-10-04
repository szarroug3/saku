import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { patternMeaningFactId } from "@/data/grammar";
import { applySeen, emptyHistory } from "@/lib/history-ops";
import type { HistoryFile } from "@/types/store";

import { sentencesToBuild } from "./sentence-reach";

const NOW = Date.UTC(2026, 8, 28);
const claims = (...ids: string[]): HistoryFile => ({ ...emptyHistory(), claims: Object.fromEntries(ids.map((id) => [patternMeaningFactId(id), NOW])) });
/** Every sentence a type would deal, by id, with no cap on how many. */
const dealt = (tierId: string, history: HistoryFile, picks: readonly string[] = []): number[] =>
  sentencesToBuild(tierId, history, picks, Infinity, () => 0.5).map((it) => it.id).sort((a, b) => a - b);

// The Simple sentences these tests read: -1 to -5 turn on を alone, in the
// dictionary form (私は水を飲む。). -101 is を with 食べた, -102 is に with
// 行った, -103 is で with 遊んだ. 10979962 has を with 行おうと, a form no
// pattern here names, and 11027752 turns on だけ.

describe("what a pick teaches", () => {
  it("is the pattern for a pattern", () => {
    assert.deepEqual(dealt("simple", emptyHistory(), ["grammar:wo"]), [-5, -4, -3, -2, -1]);
  });

  it("is both patterns for a pair", () => {
    assert.deepEqual(dealt("simple", claims("ta-form"), ["particles:ni-de"]), [-103, -102]);
  });

  it("is nothing for a word or a sentence type", () => {
    assert.deepEqual(dealt("simple", claims("ni", "ta-form"), ["word:水", "writing-rule:sentence-rule-simple"]), [-102]);
  });
});

describe("the patterns a learner knows", () => {
  it("are everything met: claimed, or opened in a lesson", () => {
    const opened = applySeen(claims("wo", "ta-form"), [patternMeaningFactId("ni")], NOW);
    assert.deepEqual(dealt("simple", opened), [-102, -101, -5, -4, -3, -2, -1]);
  });
});

describe("a sentence within reach", () => {
  it("turns on known patterns only, with every word in a known form", () => {
    const known = dealt("simple", claims("wa", "ga", "wo"));
    assert.ok(known.includes(-1), "私は水を飲む。");
    assert.ok(!known.includes(-102), "サクは店に行った。 turns on に");
    assert.ok(!known.includes(-101), "サクは寿司を食べた。 is in the た-form, which nothing here explains");
    assert.ok(dealt("simple", claims("wa", "ga", "wo", "ta-form")).includes(-101), "and is within reach once the た-form is known");
  });

  it("allows the form a known pattern makes: 行きたい is the stem plus 〜たい", () => {
    assert.ok(dealt("desire", claims("e", "tai")).includes(-301));
    assert.ok(!dealt("desire", claims("e", "yasui")).includes(-301), "〜たい is not known, and 行き is not 行く");
    assert.ok(dealt("request", claims("te-request")).includes(-201), "読んでください");
  });
});

describe("the sentences dealt for a type", () => {
  it("puts what tonight taught first, fills from the rest within reach, and never more than asked", () => {
    const history = claims("wo", "ni");
    const picked = sentencesToBuild("simple", history, ["grammar:ni"], 5, () => 0.5);
    assert.equal(picked.length, 5);
    const first = picked.findIndex((it) => !it.p.includes("ni"));
    const lastNi = picked.map((it) => it.p.includes("ni")).lastIndexOf(true);
    assert.ok(first === -1 || lastNi < first, "every に sentence comes before any other");
    for (const it of picked) assert.ok(it.p.every((p) => ["wo", "ni"].includes(p)), `${it.jp} is within reach`);
  });

  it("deals five when no count is given", () => {
    assert.equal(sentencesToBuild("simple", claims("wo")).length, 5);
  });

  it("falls back to any of the type's sentences when nothing is within reach, so a drill is never empty", () => {
    const picked = sentencesToBuild("conditional", emptyHistory(), [], 5, () => 0.5);
    assert.equal(picked.length, 5);
  });

  it("deals a type it does not know as nothing", () => {
    assert.deepEqual(sentencesToBuild("nonsense", emptyHistory()), []);
  });
});
